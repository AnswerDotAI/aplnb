import asyncio,os,signal,subprocess,sys,time
from test_kernel import TIMEOUT,_readline,read_until_ready,send,stop_kernel

# Module form rather than the jkernel/jkernel-mcp console scripts: those only appear once the
# editable install is re-run, and the module path exercises the same code.
def start_jkernel(tmp_path):
    env = os.environ.copy()
    env["XDG_CONFIG_HOME"] = str(tmp_path / "xdg")  # isolate from any real startup.ijs
    proc = subprocess.Popen([sys.executable, "-m", "iversonnb.jkernel"], stdin=subprocess.PIPE,
        stdout=subprocess.PIPE, stderr=subprocess.PIPE, env=env)
    proc._stdout_buffer = bytearray()
    return proc


def test_jkernel(tmp_path):
    "One worker through the whole protocol: results, state, multiline definitions, errors, interrupt, exit."
    proc = start_jkernel(tmp_path)
    try:
        body, delim = read_until_ready(proc)
        assert body.startswith("please wait, loading...\n")
        assert "persistent J session" in body
        assert body.endswith("loading complete. first delimiter:\n")

        assert send(proc, "2+2\n")[0] == "4\n"
        assert send(proc, "x =: 41\n")[0] == ""                       # assignment is silent
        assert send(proc, "x + 1\n")[0] == "42\n"                     # state persists
        assert send(proc, f"--\nmean =: 3 : 0\n(+/ y) % # y\n)\nmean 1 2 3 4\n{delim}\n")[0] == "2.5\n"

        body, _ = send(proc, "1 + 'a'\n")
        assert "<error>" in body and "domain error" in body
        assert send(proc, "2+2\n")[0] == "4\n"                        # session survived

        send(proc, f"--\nspin =: 3 : 0\nn =. 0\nwhile. n < 1e9 do. n =. n + 1 end.\n)\n{delim}\n")
        proc.stdin.write("spin 0\n".encode())                         # a long-running call...
        proc.stdin.flush()
        assert _readline(proc, TIMEOUT) == ".\n"
        time.sleep(0.5)
        proc.send_signal(signal.SIGINT)                               # ...interrupted (→ JInterrupt)
        body, _ = read_until_ready(proc)
        assert "attention interrupt" in body
        assert send(proc, "2+2\n")[0] == "4\n"                        # session survives an interrupt

        body, nd = send(proc, "exit 0\n")
        assert body == "" and nd == delim
        proc.wait(timeout=TIMEOUT)
        assert proc.returncode == 0
    finally: stop_kernel(proc)


def test_startup_ijs(tmp_path):
    "startup.ijs runs in the session before the first request, and its source and output appear in the banner."
    xdg = tmp_path/"xdg"
    (xdg/"iversonnb").mkdir(parents=True)
    (xdg/"iversonnb"/"startup.ijs").write_text("greeting =: 'hi from startup'\necho 'STARTUP-MARKER'\n")
    proc = start_jkernel(tmp_path)
    try:
        body, _ = read_until_ready(proc)
        assert "<startup file=" in body and "greeting" in body        # source in banner
        assert "STARTUP-MARKER" in body                               # output in banner
        assert send(proc, "greeting\n")[0] == "hi from startup\n"     # state persists
    finally: stop_kernel(proc)


async def test_jmcp(tmp_path):
    "The MCP form: jkernel tools wired to the J worker, with interrupt flowing through."
    from mcp import ClientSession, StdioServerParameters
    from mcp.client.stdio import stdio_client
    params = StdioServerParameters(command=sys.executable,
        args=["-c", "from iversonnb.jkernel import main_mcp; main_mcp()"],
        env=dict(os.environ, XDG_CONFIG_HOME=str(tmp_path/"xdg")))
    async with stdio_client(params) as (r, w), ClientSession(r, w) as s:
        init = await s.initialize()
        assert "persistent J session" in (init.instructions or "")
        tools = {t.name: t for t in (await s.list_tools()).tools}
        assert set(tools) == {"execute", "restart", "interrupt"}
        assert "J session" in tools["execute"].description            # J docs, not the Python defaults

        res = await s.call_tool("execute", {"code": "2+2"})
        assert res.content[0].text == "4"
        await s.call_tool("execute", {"code": "spin =: 3 : 0\nn =. 0\nwhile. n < 1e9 do. n =. n + 1 end.\n)"})
        task = asyncio.create_task(s.call_tool("execute", {"code": "spin 0"}))
        await asyncio.sleep(2)
        assert "interrupt sent" in (await s.call_tool("interrupt", {})).content[0].text
        assert "attention interrupt" in (await task).content[0].text  # long call returns interrupted
        res = await s.call_tool("execute", {"code": "2+2"})
        assert res.content[0].text == "4"                             # workspace survives
