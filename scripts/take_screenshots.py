import os
import subprocess
import time
import shutil

repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
out_dir = os.path.join(repo_root, 'docs', 'screenshots')
os.makedirs(out_dir, exist_ok=True)
temp_dir = os.environ.get('TEMP', os.path.join(repo_root, '.tmp'))
os.makedirs(temp_dir, exist_ok=True)

# Detect Edge executable across platforms or env override
edge_exe = (
    os.environ.get('EDGE_PATH')
    or shutil.which('msedge')
    or shutil.which('microsoft-edge')
    or r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
    or r'C:\Program Files\Microsoft\Edge\Application\msedge.exe'
)

targets = [
    ('analytics_ink', 'http://localhost:5000/?tab=analytics&theme=ink'),
    ('analytics_paper', 'http://localhost:5000/?tab=analytics&theme=paper'),
    ('wavelet_ink', 'http://localhost:5000/?tab=wavelet&theme=ink'),
    ('simulator_ink', 'http://localhost:5000/?tab=simulator&theme=ink'),
    ('governance_ink', 'http://localhost:5000/?tab=governance&theme=ink'),
]

print(f"Starting screenshot capture to {out_dir}...")

for name, url in targets:
    temp_shot = os.path.join(temp_dir, f'edge_shot_{name}.png')
    final_shot = os.path.join(out_dir, f'{name}.png')

    if os.path.exists(temp_shot):
        try: os.remove(temp_shot)
        except Exception: pass

    temp_profile = os.path.join(temp_dir, f'edge_prof_{name}')
    cmd = [
        edge_exe,
        '--headless',
        '--disable-gpu',
        '--window-size=1600,1050',
        '--virtual-time-budget=6000',
        '--hide-scrollbars',
        f'--user-data-dir={temp_profile}',
        f'--screenshot={temp_shot}',
        url
    ]

    try:
        subprocess.run(cmd, capture_output=True, timeout=25)
        if os.path.exists(temp_shot):
            shutil.copyfile(temp_shot, final_shot)
            size = os.path.getsize(final_shot)
            print(f"[OK] Captured {name}.png ({size} bytes)")
        else:
            print(f"[FAIL] Failed to capture {name}.png")
    except Exception as e:
        print(f"[ERROR] {name}: {e}")

    time.sleep(0.5)

print("Screenshot capture complete!")
