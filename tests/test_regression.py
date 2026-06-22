import asyncio
import json
import os
import sys
import logging

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")

# Add the project root to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from backend.pipeline import run_pipeline, JOBS

def test_regression_cases():
    with open("tests/known_false_positives.json", "r") as f:
        data = json.load(f)

    all_cases = data.get("known_false_negatives_as_eb", []) + \
                data.get("known_false_positives_as_planet", []) + \
                data.get("known_ui_sync_bugs", [])

    for case in all_cases:
        tic_id = case["tic_id"]
        true_classification = case["true_classification"]
        
        print(f"Testing TIC {tic_id}...")
        job_id = f"test_{tic_id}"
        from backend.pipeline import JOBS
        import time
        JOBS[job_id] = {"tic_id": tic_id, "stage": "INIT", "progress": 0, "started_at": time.time()}
        asyncio.run(run_pipeline(job_id=job_id, tic_id=tic_id, sector=None))
        
        result = JOBS[job_id]["result"]
        
        print(f"Result for {tic_id}: {json.dumps(result, indent=2)}")
        
        # Verify classification
        assert result["classification"] == true_classification, f"TIC {tic_id} failed: Expected {true_classification}, got {result['classification']}"
        
        # Verify UI sync (report_label matches classification)
        assert result["classification"] == result.get("report_label"), f"TIC {tic_id} sync failed: API says {result['classification']} but PNG says {result.get('report_label')}"
        
        print(f"TIC {tic_id} passed!")

if __name__ == "__main__":
    test_regression_cases()
    print("All regression tests passed!")
