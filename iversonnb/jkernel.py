"J clikernel: a stream-protocol worker and MCP supervisor driving J in-process via `J` (libj). Hand-written (not nbdev-exported); see `clikernel.base` for the protocol."
import signal,sys,threading,traceback
from fastcore.xdg import xdg_config_home
from clikernel.base import fmt_error,init_worker,run_mcp,run_startup,serve_stream
from iversonnb.j import J,JError

INSTRUCTIONS = "jkernel is a persistent J session: `execute` runs J code and keeps workspace state (nouns, verbs) across calls; `restart` gives a clear workspace. If a response starts with a NOTE saying the session was replaced, all workspace state is gone."

_DOCS = dict(
    execute="Run J `code` in the persistent J session, keeping workspace state (nouns, verbs) across calls.",
    restart="Kill the worker and start a fresh J session with a clear workspace; all state is discarded. Also works when `execute` is stuck: the stuck call returns an error and the session comes back fresh.",
    interrupt="Interrupt the J code the kernel is currently running (a J attention interrupt): the in-flight `execute` call returns with an attention interrupt error, and workspace state survives. Prefer this over `restart` when a call is merely taking too long. Only meaningful while an `execute` call is running.",
    died="NOTE: the kernel process had died; a fresh one was started, and all previous workspace state (nouns, verbs) is gone.\n")


def _execute(j, code):
    try: return j.run(code)
    except JError as e: return fmt_error("error", str(e))
    except Exception: return fmt_error("error", traceback.format_exc())


def main():
    init_worker()
    signal.signal(signal.SIGTERM, lambda s,f: sys.exit(0))
    j = J()
    state = dict(busy=False)
    # JDo blocks its calling thread at the C level, so each request runs on a worker thread and the main
    # thread joins in slices, staying free to run the SIGINT handler: JInterrupt is just a break-flag
    # write (safe cross-thread), and the engine polls it between sentences, ending the in-flight JDo.
    def _sigint(s,f):
        if state['busy']: j.interrupt()
    signal.signal(signal.SIGINT, _sigint)
    def execute(code):
        res = {}
        th = threading.Thread(target=lambda: res.update(out=_execute(j, code)), daemon=True)
        state['busy'] = True
        try:
            th.start()
            while th.is_alive(): th.join(0.1)
        finally: state['busy'] = False
        return res['out']
    block = run_startup(xdg_config_home()/"iversonnb"/"startup.ijs", lambda src: (j.run(src), None))
    serve_stream(execute, INSTRUCTIONS + ("\n\n" + block if block else ""), should_exit=lambda: j.exited is not None)


def main_mcp(): run_mcp([sys.executable, "-m", "iversonnb.jkernel"], name="jkernel", docs=_DOCS, instructions=INSTRUCTIONS)


if __name__ == "__main__": main()
