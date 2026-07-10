"APL clikernel: a stream-protocol worker and MCP supervisor driving Dyalog over RIDE via `Apl`. Hand-written (not nbdev-exported); see `clikernel.base` for the protocol."
import signal,sys,traceback
from fastcore.xdg import xdg_config_home
from clikernel.base import fmt_error,init_worker,run_mcp,run_startup,serve_stream
from aplnb.core import Apl,AplError,ride_send

INSTRUCTIONS = "aplkernel is a persistent Dyalog APL session: `execute` runs APL code and keeps workspace state (variables, functions) across calls; `restart` gives a clear workspace. If a response starts with a NOTE saying the session was replaced, all workspace state is gone."

_RESET = "NOTE: the Dyalog interpreter was replaced with a fresh session; all previous workspace state (variables, functions) is gone.\n"

_DOCS = dict(
    execute="Run APL `code` in the persistent Dyalog session, keeping workspace state (variables, functions) across calls. If the session had to be replaced (the interpreter died, or incomplete input hit Dyalog/ride#1401), the response starts with a NOTE saying workspace state was lost.",
    restart="Kill the worker and start a fresh Dyalog session with a clear workspace; all state is discarded. Also works when `execute` is stuck: the stuck call returns an error and the session comes back fresh.",
    interrupt="Interrupt the APL code the kernel is currently running (a RIDE StrongInterrupt): the in-flight `execute` call returns with an INTERRUPT error, and workspace state survives. Prefer this over `restart` when a call is merely taking too long. Only meaningful while an `execute` call is running.",
    died="NOTE: the kernel process had died; a fresh one was started, and all previous workspace state (variables, functions) is gone.\n")


def _execute(apl, code):
    try: return apl.run(code)
    except AplError as e:
        body = fmt_error("error", str(e))
        return _RESET + body if e.reset else body
    except Exception:
        apl.close()
        apl._connect()
        return _RESET + fmt_error("error",
            f"the Dyalog session died while executing this request; a fresh session was started\n{traceback.format_exc()}")


def main():
    init_worker()
    # SIGTERM (the supervisor's graceful kill) becomes SystemExit, so atexit shuts Dyalog down.
    # SIGINT becomes a RIDE StrongInterrupt when a request is running (see the probe notes in tests):
    # the interpreter answers with an INTERRUPT error and the session survives; when idle it's a no-op,
    # since an idle StrongInterrupt is silent but a stray KeyboardInterrupt would desync the stream.
    signal.signal(signal.SIGTERM, lambda s,f: sys.exit(0))
    apl = Apl()
    state = dict(exit=False, busy=False)
    def _sigint(s,f):
        if state['busy']: ride_send(apl.sock, ['StrongInterrupt',{}])
    signal.signal(signal.SIGINT, _sigint)
    def execute(code):
        if code.strip().upper() == ')OFF':
            state['exit'] = True
            return ""
        state['busy'] = True
        try: return _execute(apl, code)
        finally: state['busy'] = False
    block = run_startup(xdg_config_home()/"aplnb"/"startup.apl", lambda src: (apl.run(src), None))
    serve_stream(execute, INSTRUCTIONS + ("\n\n" + block if block else ""), should_exit=lambda: state['exit'])


def main_mcp(): run_mcp([sys.executable, "-m", "aplnb.kernel"], name="aplkernel", docs=_DOCS, instructions=INSTRUCTIONS)


if __name__ == "__main__": main()
