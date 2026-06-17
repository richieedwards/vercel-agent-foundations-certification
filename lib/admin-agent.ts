/**
 * This is where your admin agent will live.
 *
 * During the workshop you'll define a `ToolLoopAgent` here, give it a model
 * and instructions, and later add tools (web search, sandbox, etc.). The
 * route handler in `app/api/admin/chat/route.ts` and the `useChat` call in
 * `components/admin-agent-chat.tsx` will both import from this file.
 *
 * Workshop docs: https://agent-foundations-certification.vercel.app/docs/admin-chat-agent
 */

import { InferAgentUIMessage, tool, ToolLoopAgent } from "ai";
import { z } from "zod";
import {
    ApiRequestError,
    getBackOfficeReturns,
    getBackOfficeSales,
    getBackOfficeStock,
    getBackOfficeSupportTickets,
    getProducts,
} from "@/lib/api";
import { Sandbox } from "@vercel/sandbox";

const backOfficeInstructions = `[current agent instructions from prior steps]`; 

const callOptionsSchema = z.object({
    sandbox: z.instanceof(Sandbox),
});

const getSupportTickets = tool({
    description: `List support tickets from the back office within a date range. Each ticket includes status, priority, category, assignee (staff username or null when unassigned), the related customer/order, and timestamps. Use this for triaging the support queue, spotting spikes in a category, checking workload by assignee, or auditing unresolved urgent tickets. History covers ~last 180 days. Summarize across the rows in your reply rather than dumping them; for more than ~10 rows of arithmetic, note that exact joins and aggregates are limited until a sandbox tool is added.`,
    inputSchema: z.object({
        from: z
            .string()
            .optional()
            .describe(
                `ISO 8601 datetime or YYYY-MM-DD. Defaults to 30 days before "to". If the user gives a vague window ("this month", "recently"), pick a sensible range, state it explicitly in your reply, and proceed.`,
            ),
        to: z
            .string()
            .optional()
            .describe(`ISO 8601 datetime or YYYY-MM-DD. Defaults to now.`),
        status: z.enum(["open", "pending", "resolved", "closed"]).optional(),
        priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
        category: z
            .enum([
                "shipping",
                "returns",
                "product_quality",
                "sizing",
                "billing",
                "payment",
                "account",
                "other",
            ])
            .optional(),
        assignee: z
            .string()
            .optional()
            .describe(
                `Staff username (e.g. "alex"). When set, unassigned tickets are excluded.`,
            ),
        limit: z.number().int().min(1).max(500).optional(),
    }),
    execute: async ({
        from,
        to,
        status,
        priority,
        category,
        assignee,
        limit,
    }) => {
        try {
            const { data, meta } = await getBackOfficeSupportTickets({
                from,
                to,
                status,
                priority,
                category,
                assignee,
                limit,
            });
            return { count: data.length, tickets: data, range: meta };
        } catch (err) {
            const message =
                err instanceof ApiRequestError ? err.message : "Unknown error";
            return { count: 0, tickets: [], error: message };
        }
    },
});

const searchProducts = tool({
    description: `Search the Vercel swag store product catalog. Use this whenever the user asks about products, what the store sells, or needs to map a category like "hoodies" to specific product ids before joining against sales or returns.`,
    inputSchema: z.object({
        query: z
            .string()
            .optional()
            .describe(
                `Optional free-text search terms describing what the user is looking for, e.g. 'hoodie' or 'water bottle'.`,
            ),
        category: z
            .enum([
                "bottles",
                "cups",
                "mugs",
                "desk",
                "stationery",
                "accessories",
                "bags",
                "hats",
                "t-shirts",
                "hoodies",
                "socks",
                "tech",
                "books",
            ])
            .optional()
            .describe(
                `Optional category slug to filter results. Only set this when the user clearly wants a specific category.`,
            ),
    }),
    execute: async ({ query, category }) => {
        try {
            const products = await getProducts({
                search: query,
                category,
                limit: 10,
            });
            return {
                count: products.length,
                products: products.map((p) => ({
                    id: p.id,
                    name: p.name,
                    slug: p.slug,
                    price: p.price,
                    currency: p.currency,
                    category: p.category,
                    description: p.description,
                })),
            };
        } catch (err) {
            const message =
                err instanceof ApiRequestError ? err.message : "Unknown error";
            return { count: 0, products: [], error: message };
        }
    },
});

const getReturnsHistory = tool({
    description: `List historical returns from the back office within a date range. Each entry includes the items returned, the decision (approved/rejected/needs_info), refund amount in cents (divide by 100 for dollar amounts in your reply), and a summary of the related order. Use this for return triage, refund auditing, or identifying products with high return volumes. History covers ~last 180 days. Summarize across the returned rows in your reply rather than dumping them; for more than ~10 rows of arithmetic, note that exact joins and aggregates are limited until a sandbox tool is added.`,
    inputSchema: z.object({
        from: z
            .string()
            .optional()
            .describe(
                `ISO 8601 datetime or YYYY-MM-DD. Defaults to 30 days before "to". If the user gives a vague window ("this month", "recently"), pick a sensible range, state it explicitly in your reply, and proceed.`,
            ),
        to: z
            .string()
            .optional()
            .describe(`ISO 8601 datetime or YYYY-MM-DD. Defaults to now.`),
        status: z.enum(["pending", "processing", "completed"]).optional(),
        decision: z.enum(["approved", "rejected", "needs_info"]).optional(),
        limit: z.number().int().min(1).max(500).optional(),
    }),
    execute: async ({ from, to, status, decision, limit }) => {
        try {
            const { data, meta } = await getBackOfficeReturns({
                from,
                to,
                status,
                decision,
                limit,
            });
            return { count: data.length, returns: data, range: meta };
        } catch (err) {
            const message =
                err instanceof ApiRequestError ? err.message : "Unknown error";
            return { count: 0, returns: [], error: message };
        }
    },
});

const getInventoryStock = tool({
    description: `Current stock levels for all products (or a subset). Results are sorted by stock ascending, so out-of-stock and low-stock items appear first. Use this to answer questions about availability, restocking priorities, or which items are about to run out. Summarize the rows in your reply rather than dumping them.`,
    inputSchema: z.object({
        productIds: z
            .array(z.string())
            .optional()
            .describe(`Restrict the query to specific product ids.`),
        lowStock: z
            .boolean()
            .optional()
            .describe(
                `true = only items with 1–5 units in stock; false = exclude low-stock items.`,
            ),
        inStock: z
            .boolean()
            .optional()
            .describe(`true = only items with at least one unit; false = only zero.`),
        page: z.number().int().min(1).optional(),
        limit: z.number().int().min(1).max(200).optional(),
    }),
    execute: async ({ productIds, lowStock, inStock, page, limit }) => {
        try {
            const { data, meta } = await getBackOfficeStock({
                productIds,
                lowStock,
                inStock,
                page,
                limit,
            });
            return { count: data.length, stock: data, pagination: meta.pagination };
        } catch (err) {
            const message =
                err instanceof ApiRequestError ? err.message : "Unknown error";
            return { count: 0, stock: [], error: message };
        }
    },
});

const getSalesAnalytics = tool({
    description: `Sales totals by product within a date range. Each row reports unitsSold, ordersCount, and revenue in cents (divide by 100 for dollar amounts in your reply). Results are sorted by unitsSold descending. Pair with getReturnsHistory to compute per-product return rates. Sales data covers ~last 180 days. Summarize across the rows in your reply rather than dumping them; for more than ~10 rows of arithmetic, note that exact joins and aggregates are limited until a sandbox tool is added.`,
    inputSchema: z.object({
        from: z
            .string()
            .optional()
            .describe(
                `ISO 8601 datetime or YYYY-MM-DD. Defaults to 30 days before "to". If the user gives a vague window ("this month", "recently"), pick a sensible range, state it explicitly in your reply, and proceed.`,
            ),
        to: z
            .string()
            .optional()
            .describe(`ISO 8601 datetime or YYYY-MM-DD. Defaults to now.`),
        productId: z
            .string()
            .optional()
            .describe(`Restrict to a single product. 404s if it doesn't exist.`),
    }),
    execute: async ({ from, to, productId }) => {
        try {
            const { data, meta } = await getBackOfficeSales({ from, to, productId });
            return { count: data.length, sales: data, summary: meta };
        } catch (err) {
            const message =
                err instanceof ApiRequestError ? err.message : "Unknown error";
            return { count: 0, sales: [], error: message };
        }
    },
});

const bash = tool({
    description: "Run a bash command in the sandbox environment",
    inputSchema: z.object({
        command: z.string().describe("The bash command to run"),
    }),
    execute: async ({ command }, { experimental_context }) => {
        const context = agentContextSchema.parse(experimental_context);
        const result = await context.sandbox.runCommand("bash", ["-lc", command]);
        return {
            stdout: await result.stdout(),
            stderr: await result.stderr(),
            exitCode: result.exitCode,
        };
    },
});

export const adminAgent = new ToolLoopAgent({
    model: "anthropic/claude-sonnet-4.6",
    instructions: backOfficeInstructions,
    tools: {
        bash,
        getReturnsHistory,
        getInventoryStock,
        getSalesAnalytics,
        getSupportTickets,
        searchProducts,
    },
    callOptionsSchema,
    prepareCall: async ({ options, ...rest }) => { 
    const buffer = await options.sandbox.readFileToBuffer({ 
      path: "memories.md", 
    }); 
    const memories = buffer ? new TextDecoder().decode(buffer) : null; 
    return {
      ...rest,
      experimental_context: agentContextSchema.parse({
        sandbox: options.sandbox,
      }),
      instructions: [ 
        backOfficeInstructions, 
        "", 
        "## Memory protocol", 
        "You have a memories.md file at /vercel/sandbox/memories.md.", 
        "Read it on every turn (the current contents are injected below).", 
        "When the user shares back-office context worth carrying across sessions, append it via the bash tool.", 
        "", 
        memories 
          ? `## Current memories\n\n${memories}`
          : "No memories yet.",
        "", 
        "## Priority order for any request", 
        "1. Check your memories above and any scripts logged under '## Scripts for common tasks'. If a saved script handles this request, run it with bash and return the output.", 
        "2. Otherwise, do the task using the data tools and bash.", 
        "3. After answering, decide whether the task could be a reusable script for next time.", 
        "", 
        "## When to save", 
        "Append a line to memories.md when the user shares something that should color future answers:", 
        "- Presentation preferences (percentages vs raw counts, terse vs detailed breakdowns, currency formatting)", 
        "- Business context that's not derivable from the data (which products are seasonal, what 'normal' looks like for a metric, which stakeholder cares about what)", 
        "- Explanations the user has given for past anomalies so you don't re-flag them next time", 
        "- Corrections or feedback the user gave you on a prior answer", 
        "", 
        "Do NOT save routine questions, one-off lookups, or anything you can re-derive from the data tools.", 
        "", 
        "## How to use memory", 
        "Read the current memories above on every turn so prior context shapes your reply.", 
        "When you notice the user repeating a question, giving feedback like 'show this as %', or correcting a past answer, append a one-liner to memories.md.", 
        "Don't interview the user. Capture signal opportunistically as it comes up.",
        "", 
        "## Reusable scripts", 
        "After answering a recurring operational question (top sellers last week, refund rate by category, weekly summary), consider writing a Python script that produces the same report on demand.", 
        "Save scripts to /vercel/sandbox/scripts/<name>.py so the user can re-run them later with `python3 scripts/<name>.py` instead of asking you again.", 
        "Stdlib only, no pandas. Make scripts self-contained and well-commented. Always invoke with `python3`, never `python`.", 
        "After creating a script, log it in memories.md under '## Scripts for common tasks' with the filename and a one-line description (e.g. `top_sellers_last_week.py: top 10 SKUs by units sold in the last 7 days`).", 
      ].join("\n"), 
    };
  },
});

export const agentContextSchema = z.object({
    sandbox: z.instanceof(Sandbox),
});
export type AgentContext = z.infer<typeof agentContextSchema>; 
export type AdminAgentUIMessage = InferAgentUIMessage<typeof adminAgent>;