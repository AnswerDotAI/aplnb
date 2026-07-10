__version__ = "0.1.1"
from .core import *
from .j import create_j_magic

def load_ipython_extension(ipython):
    "Register both the `apl` and `j` magics"
    create_magic(shell=ipython)
    create_j_magic(shell=ipython)
