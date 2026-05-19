/**
 * This is where your agent will live.
 *
 * During the workshop you'll define a `ToolLoopAgent` here, give it a model
 * and instructions, and later add tools (web search, sandbox, etc.). The
 * route handler in `app/api/chat/route.ts` and the `useChat` call in
 * `components/agent-chat.tsx` will both import from this file.
 *
 * Workshop docs: https://agent-foundations-certification.vercel.app/docs/chat-agent
 */

import { tool, ToolLoopAgent,type InferAgentUIMessage, type UIToolInvocation,  } from "ai"; 
import { z } from "zod"; 
import { ApiRequestError, getCategories, getProducts, getProductById } from "@/lib/api";
import { start } from "workflow/api";
import { returnFlow } from "./workflows/return-flow";

const processReturn = tool({
  description: `File a return for one of the user's orders. The user must provide an order ID. Valid order IDs in this demo are 11111, 22222, 33333, 44444, 55555. Returns immediately.`,
  inputSchema: z.object({
    orderId: z
      .string()
      .describe("The order ID the user wants to return."),
    reason: z
      .string()
      .min(10)
      .max(500)
      .describe("Why the user is returning the order."),
  }),
  execute: async ({ orderId, reason }) => {
    try {
      const run = await start(returnFlow, [orderId, reason]);
      return {
        runId: run.runId,
        message: `Return filed for order ${orderId}.`,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return { error: message };
    }
  },
});

const getProductDetails = tool({
  description: `Get detailed information about a specific product in the Vercel swag store using it's ID. Use this when the user asks for more information about a product, e.g. 'Tell me more about the Vercel hoodie'.`,
  inputSchema: z.object({
    id: z.string().describe("The ID of the product to retrieve details for."),
  }),
  execute: async ({ id }) => {
    try {
      const product = await getProductById(id);
      console.log("getProductDetails result:", product);
      return product;
    } catch (err) {
      const message =
        err instanceof ApiRequestError ? err.message : "Unknown error";
      return { error: message };
    }
  },
});

const getAllCategories = tool({
  description: `List every product category available in the Vercel swag store, along with the number of products in each.
  Use this when the user asks what categories exist, what kinds of products are sold, or wants to browse the store at a high level.
  If the user asks about products in a specific category, use this tool to find an approximate match first and then use your other tools to find products in that category.
  For example, if the user asks for 'hats', you might find a category called 'headwear' that seems like a good match and then use that category to find relevant products.`,
  inputSchema: z.object({}),
  execute: async () => {
    try {
      const categories = await getCategories();
      return {
        count: categories.length,
        categories: categories.map((c) => ({
          slug: c.slug,
          name: c.name,
          productCount: c.productCount,
        })),
      };
    } catch (err) {
      const message =
        err instanceof ApiRequestError ? err.message : "Unknown error";
      return { count: 0, categories: [], error: message };
    }
  },
});

const searchProducts = tool({
  description: `Search the Vercel swag store product catalog. Use this whenever the user asks about products, what the store sells, or wants recommendations. Optionally narrow results to a single category.`,
  inputSchema: z.object({
    query: z
      .string()
      .optional()
      .describe(
        `Optional, free-text search terms describing what the user is looking for, e.g. 'hoodie' or 'water bottle'.`,
      ),
      category: z 
      .string() 
      .optional() 
      .describe( 
        `Optional category slug to filter results. Only set this when the user clearly wants a specific category. Use the getAllCategories tool to get all valid categories.`, 
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

export const shoppingAgent = new ToolLoopAgent({
    model: "anthropic/claude-sonnet-4.6",
    instructions: `You are a friendly shopping assistant for the Vercel swag store.
    Please help the user find and purchase items from the store.
    If the user asks for something you don't have, politely let them know.
    When the user wants to return an order use the processReturn tool. Ask for the order ID and reason if they haven't given them. Valid demo order IDs are 11111-55555.`, 
    tools: { searchProducts, getAllCategories, getProductDetails, processReturn }, 
 });

export type ShoppingAgentUIMessage = InferAgentUIMessage<typeof shoppingAgent>;
export type ProductDetailsToolInvocation = UIToolInvocation<typeof getProductDetails>;
export type CategoryListToolInvocation = UIToolInvocation<typeof getAllCategories>;