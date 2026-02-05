# Copilot Eval Rubric (Heuristic)

Each test case is scored with:

- schema_pass (0/1)
  - 1 if output validates against the Copilot JSON schema.

- actionability (0-5)
  - Higher if recommended actions are concrete, prioritized, and explain "why".

- specificity_to_data (0-5)
  - Higher if the response cites multiple relevant used_data_points (dates, deltas, anomalies, forecast).

- hallucination_penalty (0-5)
  - Start at 5 and subtract when the response makes claims not supported by used_data_points.

Total score is not a single number by default; we report the vector per test.
