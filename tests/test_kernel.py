import asyncio,os,re,select,shutil,signal,subprocess,sys,time

DELIM_RE = re.compile(r"--[A-Za-z0-9]{5}")
TIMEOUT = 20  # Dyalog spawn takes a few seconds


def _readline(proc, timeout):
    buf = proc._stdout_buffer
    while b"\n" not in buf:
        ready, _, _ = select.select([proc.stdout], [], [], timeout)
        if not ready: raise AssertionError("timed out waiting for aplkernel output")
        chunk = os.read(proc.stdout.fileno(), 4096)
        assert chunk, "aplkernel closed stdout"
        buf.extend(chunk)
    line, _, rest = buf.partition(b"\n")
    proc._stdout_buffer = bytearray(rest)
    return line.decode("utf-8", "replace") + "\n"


def read_until_ready(proc, timeout=TIMEOUT):
    lines = []
    deadline = time.monotonic() + timeout
    while True:
        remaining = deadline - time.monotonic()
        if remaining <= 0: raise AssertionError("timed out waiting for ready delimiter")
        line = _readline(proc, remaining)
        s = line.rstrip("\n")
        if DELIM_RE.fullmatch(s): return "".join(lines), s
        lines.append(line)


def start_kernel(tmp_path):
    env = os.environ.copy()
    env["XDG_CONFIG_HOME"] = str(tmp_path / "xdg")  # isolate from any real startup.apl
    cmd = shutil.which("aplkernel")
    assert cmd, "aplkernel console script is not on PATH"
    proc = subprocess.Popen([cmd], stdin=subprocess.PIPE,
        stdout=subprocess.PIPE, stderr=subprocess.PIPE, env=env)
    proc._stdout_buffer = bytearray()
    return proc


def stop_kernel(proc):
    if proc.stdin is not None:
        try: proc.stdin.close()
        except OSError: pass
    if proc.poll() is None:
        try: proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            proc.kill()
            proc.wait(timeout=5)


def send(proc, text, timeout=TIMEOUT):
    proc.stdin.write(text.encode("utf-8"))
    proc.stdin.flush()
    assert _readline(proc, timeout) == ".\n"
    return read_until_ready(proc, timeout)


def test_kernel(tmp_path):
    "One worker through the whole protocol: results, state, multiline, errors, session replacement, )OFF."
    proc = start_kernel(tmp_path)
    try:
        body, delim = read_until_ready(proc)
        assert body.startswith("please wait, loading...\n")
        assert "Dyalog APL session" in body
        assert body.endswith("loading complete. first delimiter:\n")

        assert send(proc, "2+2\n")[0] == "4\n"
        assert send(proc, "x←41\n")[0] == ""                          # assignment is silent
        assert send(proc, "x+1\n")[0] == "42\n"                       # state persists
        assert send(proc, f"--\na←3\nb←4\na+b\n{delim}\n")[0] == "7\n"

        body, _ = send(proc, "1÷0\n")
        assert "<error>" in body and "DOMAIN ERROR" in body

        body, _ = send(proc, "y←⎕\n")                                 # ⎕ input request is refused
        assert "not supported" in body
        assert send(proc, "2+2\n")[0] == "4\n"                        # session survived

        body, _ = send(proc, ":If 1\n")                               # wedges the interpreter (Dyalog/ride#1401)
        assert body.startswith("NOTE:") and "workspace state" in body and "wedged" in body
        assert "VALUE ERROR" in send(proc, "x+1\n")[0]                # state genuinely gone
        assert send(proc, "2+2\n")[0] == "4\n"                        # fresh session works

        proc.stdin.write("⎕DL 30\n".encode())                        # a long-running call...
        proc.stdin.flush()
        assert _readline(proc, TIMEOUT) == ".\n"
        time.sleep(0.5)
        proc.send_signal(signal.SIGINT)                               # ...interrupted (→ RIDE StrongInterrupt)
        body, _ = read_until_ready(proc)
        assert "INTERRUPT" in body
        assert send(proc, "2+2\n")[0] == "4\n"                        # session survives an interrupt

        body, nd = send(proc, ")OFF\n")
        assert body == "" and nd == delim
        proc.wait(timeout=TIMEOUT)
        assert proc.returncode == 0
    finally: stop_kernel(proc)


def test_startup_apl(tmp_path):
    "startup.apl runs in the session before the first request, and its source and output appear in the banner."
    xdg = tmp_path/"xdg"
    (xdg/"aplnb").mkdir(parents=True)
    (xdg/"aplnb"/"startup.apl").write_text("greeting←'hi from startup'\n⎕←'STARTUP-MARKER'\n")
    proc = start_kernel(tmp_path)
    try:
        body, _ = read_until_ready(proc)
        assert "<startup file=" in body and "greeting" in body        # source in banner
        assert "STARTUP-MARKER" in body                               # output in banner
        assert send(proc, "greeting\n")[0] == "hi from startup\n"     # state persists
    finally: stop_kernel(proc)


def test_sigterm_no_orphan(tmp_path):
    "SIGTERM (the supervisor's graceful kill) shuts down the Dyalog interpreter instead of orphaning it."
    proc = start_kernel(tmp_path)
    try:
        read_until_ready(proc)
        dy_pid = int(send(proc, "⊃⎕SH'echo $PPID'\n")[0])             # the shell's parent is the interpreter
        os.kill(dy_pid, 0)                                            # interpreter is alive
        proc.send_signal(signal.SIGTERM)
        proc.wait(timeout=TIMEOUT)
        deadline = time.monotonic() + 5
        while time.monotonic() < deadline:
            try: os.kill(dy_pid, 0)
            except ProcessLookupError: return
            time.sleep(0.1)
        raise AssertionError("Dyalog interpreter outlived the worker")
    finally: stop_kernel(proc)


async def test_mcp(tmp_path):
    "The MCP form: aplkernel tools wired to the APL worker, with session-reset NOTEs flowing through."
    from mcp import ClientSession, StdioServerParameters
    from mcp.client.stdio import stdio_client
    cmd = shutil.which("aplkernel-mcp")
    assert cmd, "aplkernel-mcp console script is not on PATH"
    params = StdioServerParameters(command=cmd,
        env=dict(os.environ, XDG_CONFIG_HOME=str(tmp_path/"xdg")))
    async with stdio_client(params) as (r, w), ClientSession(r, w) as s:
        init = await s.initialize()
        assert "Dyalog APL session" in (init.instructions or "")
        tools = {t.name: t for t in (await s.list_tools()).tools}
        assert set(tools) == {"execute", "restart", "interrupt"}
        assert "Dyalog" in tools["execute"].description                 # APL docs, not the Python defaults

        res = await s.call_tool("execute", {"code": "2+2"})
        assert res.content[0].text == "4"
        res = await s.call_tool("execute", {"code": ":If 1"})           # wedge → reset
        assert res.content[0].text.startswith("NOTE:")
        res = await s.call_tool("execute", {"code": "2+2"})             # fresh session works
        assert res.content[0].text == "4"

        task = asyncio.create_task(s.call_tool("execute", {"code": "⎕DL 30"}))
        await asyncio.sleep(2)
        assert "interrupt sent" in (await s.call_tool("interrupt", {})).content[0].text
        assert "INTERRUPT" in (await task).content[0].text                # long call returns interrupted
        res = await s.call_tool("execute", {"code": "2+2"})
        assert res.content[0].text == "4"                                # workspace survives

