# Global interceptor with URL-shape gate

The capture-phase click interceptor stays global, but text-only matches (`download pdf`, `[pdf]`, bare `pdf`) now hijack only on academic-publisher hosts or same-origin links. A bare URL shape (`.pdf`, `/doi/pdf/`, `/doi/epdf/`) still hijacks anywhere. Academia/ResearchGate externals and Sci-Hub/Libgen internals remain deliberate Search-Link-only skips.
