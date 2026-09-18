set -e
D=/Users/zhaozicheng/.omp/agent
echo "=== verify ==="
shasum -a 256 $D/models.yml $D/config.yml
echo "=== backups ==="
ls -la $D/ | grep beforesync
echo "=== yaml parse (python) ==="
/usr/bin/python3 - <<'PY'
import sys
try:
    import yaml
except ImportError:
    print("pyyaml missing"); sys.exit(0)
for f in ["/Users/zhaozicheng/.omp/agent/models.yml","/Users/zhaozicheng/.omp/agent/config.yml"]:
    d=yaml.safe_load(open(f))
    print(f, "-> OK, top keys:", list(d.keys()))
    if "providers" in d:
        for k,v in d["providers"].items():
            print("   provider", k, "baseUrl=", v.get("baseUrl"), "models=", [m["id"] for m in v.get("models",[])])
PY
echo "=== omp procs ==="
ps aux | grep -i "[o]mp" | head -10
echo "=== DONE ==="