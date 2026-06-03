"""Tool definitions and dispatch for the TradeDesk agent.

Tool schemas are provider-neutral: {name, description, parameters} where
`parameters` is a JSON Schema. Each provider adapts them to its own format
(Anthropic `input_schema`, OpenAI/Gemini/Ollama `function.parameters`). Descriptions
state *when* to call the tool — models reach for tools conservatively, so the
trigger condition matters.
"""

from __future__ import annotations

import json
from typing import Any

from .ops_client import OpsClient

TOOL_SCHEMAS: list[dict[str, Any]] = [
    {
        "name": "list_customers",
        "description": (
            "List the customers on file with their ids (e.g. CUST-1001), contact and "
            "site address. Call this when you need a customer's id, or when the user "
            "asks who the customers are or for a customer's contact details."
        ),
        "parameters": {"type": "object", "properties": {}, "required": []},
    },
    {
        "name": "search_jobs",
        "description": (
            "List jobs from the operational system, optionally filtered. Call this "
            "whenever the user asks what's on, what's scheduled, what's outstanding, "
            "or about a particular customer's jobs. Returns a summary of each job."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "status": {
                    "type": "string",
                    "enum": ["quote_requested", "scheduled", "in_progress", "completed"],
                    "description": "Optional. Filter to jobs in this status.",
                },
                "customer_name": {
                    "type": "string",
                    "description": "Optional. Partial customer name to filter by.",
                },
            },
            "required": [],
        },
    },
    {
        "name": "get_job",
        "description": (
            "Fetch the full detail of one job by its id (e.g. JOB-5016), including the "
            "customer record and site address. Call this before drafting a quote or a "
            "customer message about a specific job, so you have the real details."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "job_id": {"type": "string", "description": "The job id, e.g. JOB-5016."},
            },
            "required": ["job_id"],
        },
    },
    {
        "name": "list_invoices",
        "description": (
            "List invoices. Set only_overdue=true when the user asks about overdue, "
            "outstanding, or chasing payments. Returns amount, due date, and days overdue."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "only_overdue": {
                    "type": "boolean",
                    "description": "If true, return only unpaid invoices past their due date.",
                },
            },
            "required": [],
        },
    },
    {
        "name": "create_quote",
        "description": (
            "Create a draft quote against a job. Use this only after get_job, so the "
            "scope is accurate. You supply itemised materials and an estimate of labour "
            "hours; the system computes materials total, labour total, GST and the final "
            "total. The quote is saved as a draft for a human to review and send."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "job_id": {"type": "string", "description": "Job to quote against."},
                "line_items": {
                    "type": "array",
                    "description": "Itemised materials/parts for the quote.",
                    "items": {
                        "type": "object",
                        "properties": {
                            "description": {"type": "string"},
                            "qty": {"type": "number"},
                            "unit_price": {"type": "number", "description": "Ex-GST unit price in AUD."},
                        },
                        "required": ["description", "qty", "unit_price"],
                    },
                },
                "labour_hours": {"type": "number", "description": "Estimated labour hours."},
                "notes": {"type": "string", "description": "Optional notes / assumptions for the customer."},
            },
            "required": ["job_id", "line_items", "labour_hours"],
        },
    },
    {
        "name": "draft_customer_message",
        "description": (
            "Draft a customer-facing message (e.g. a payment reminder for an overdue "
            "invoice, or a scheduling note for a job) and save it as a draft for a human "
            "to review before sending. Reference the invoice or job id. Keep the tone "
            "professional and friendly; never threaten or invent figures."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "reference_id": {"type": "string", "description": "Invoice or job id the message is about."},
                "purpose": {
                    "type": "string",
                    "enum": ["payment_reminder", "scheduling", "quote_follow_up", "general"],
                    "description": "What the message is for.",
                },
                "body": {"type": "string", "description": "The drafted message text."},
            },
            "required": ["reference_id", "purpose", "body"],
        },
    },
]


def execute_tool(client: OpsClient, name: str, tool_input: dict[str, Any]) -> str:
    """Run a tool by name and return a JSON string result for the model."""
    try:
        if name == "list_customers":
            result = client.list_customers()
        elif name == "search_jobs":
            result = client.search_jobs(
                status=tool_input.get("status"),
                customer_name=tool_input.get("customer_name"),
            )
        elif name == "get_job":
            result = client.get_job(tool_input["job_id"])
            if result is None:
                return json.dumps({"error": f"No job found with id {tool_input['job_id']}"})
        elif name == "list_invoices":
            result = client.list_invoices(only_overdue=tool_input.get("only_overdue", False))
        elif name == "create_quote":
            result = client.create_quote(
                job_id=tool_input["job_id"],
                line_items=tool_input["line_items"],
                labour_hours=tool_input["labour_hours"],
                notes=tool_input.get("notes", ""),
            )
        elif name == "draft_customer_message":
            result = client.draft_customer_message(
                reference_id=tool_input["reference_id"],
                purpose=tool_input["purpose"],
                body=tool_input["body"],
            )
        else:
            return json.dumps({"error": f"Unknown tool: {name}"})

        return json.dumps(result, default=str)
    except Exception as exc:  # surface errors to the model so it can recover
        return json.dumps({"error": str(exc)})
