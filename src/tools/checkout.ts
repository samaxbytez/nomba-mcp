import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { NombaClient } from "../client.js";
import { jsonResponse, errorResponse, logToolCall } from "../utils.js";

export function registerCheckoutTools(
  server: McpServer,
  client: NombaClient
): void {
  server.registerTool(
    "nomba_create_checkout_order",
    {
      title: "Create Checkout Order",
      description:
        // Nomba is NGN-only
        "Create a checkout payment order and get a payment link. The customer can use this link to pay via card, bank transfer, or USSD. Amount is in Naira (NGN).",
      annotations: { readOnlyHint: false, destructiveHint: true },
      inputSchema: {
        amount: z.number().positive().describe("Payment amount in Naira"),
        customerEmail: z
          .string()
          .email()
          .describe("Customer's email address"),
        callbackUrl: z
          .string()
          .url()
          .describe("URL to redirect the customer to after payment"),
        orderReference: z
          .string()
          .optional()
          .describe("Your unique order reference/ID"),
        customerId: z
          .string()
          .optional()
          .describe("Your internal customer identifier"),
        tokenizeCard: z
          .boolean()
          .optional()
          .describe("Whether to save the customer's card for future charges"),
      },
    },
    async ({
      amount,
      customerEmail,
      callbackUrl,
      orderReference,
      customerId,
      tokenizeCard,
    }) => {
      logToolCall("nomba_create_checkout_order", { amount, customerEmail });
      try {
        const result = await client.post("/v1/checkout/order", {
          order: {
            amount,
            currency: "NGN", // Nomba is NGN-only
            customerEmail,
            callbackUrl,
            orderReference,
            customerId,
          },
          tokenizeCard,
        });
        return jsonResponse(result);
      } catch (error) {
        return errorResponse(error);
      }
    }
  );

  server.registerTool(
    "nomba_charge_tokenized_card",
    {
      title: "Charge Tokenized Card",
      description:
        "Charge a previously saved/tokenized card. Use this for recurring payments or returning customers who saved their card during checkout.",
      annotations: { readOnlyHint: false, destructiveHint: true },
      inputSchema: {
        amount: z.number().positive().describe("Amount in Naira to charge"),
        tokenizedCardId: z
          .string()
          .describe("The tokenized card ID from a previous checkout"),
        customerEmail: z
          .string()
          .email()
          .describe("Customer's email address"),
      },
    },
    async ({ amount, tokenizedCardId, customerEmail }) => {
      logToolCall("nomba_charge_tokenized_card", { amount, customerEmail });
      try {
        const result = await client.post(
          "/v1/checkout/charge-tokenized-card",
          { amount, tokenizedCardId, customerEmail }
        );
        return jsonResponse(result);
      } catch (error) {
        return errorResponse(error);
      }
    }
  );

  server.registerTool(
    "nomba_refund_transaction",
    {
      title: "Refund Transaction",
      description:
        "Process a refund for a completed checkout transaction. You can do a full or partial refund by specifying the amount.",
      annotations: { readOnlyHint: false, destructiveHint: true },
      inputSchema: {
        transactionId: z
          .string()
          .describe("The transaction ID to refund"),
        amount: z
          .number()
          .positive()
          .optional()
          .describe(
            "Amount to refund in Naira. Omit for full refund."
          ),
      },
    },
    async ({ transactionId, amount }) => {
      logToolCall("nomba_refund_transaction", { transactionId, amount });
      try {
        const body: Record<string, unknown> = { transactionId };
        if (amount !== undefined) body.amount = amount;
        const result = await client.post("/v1/checkout/refund", body);
        return jsonResponse(result);
      } catch (error) {
        return errorResponse(error);
      }
    }
  );

  server.registerTool(
    "nomba_get_checkout_transaction",
    {
      title: "Get Checkout Transaction Details",
      description:
        "Retrieve the details and status of a checkout transaction by its order reference.",
      annotations: { readOnlyHint: true, destructiveHint: false },
      inputSchema: {
        orderReference: z
          .string()
          .describe("The order reference from the checkout order creation"),
      },
    },
    async ({ orderReference }) => {
      logToolCall("nomba_get_checkout_transaction", { orderReference });
      try {
        const result = await client.get(
          `/v1/checkout/order/${orderReference}`
        );
        return jsonResponse(result);
      } catch (error) {
        return errorResponse(error);
      }
    }
  );

  server.registerTool(
    "nomba_cancel_transaction",
    {
      title: "Cancel Checkout Transaction",
      description:
        "Cancel an incomplete/pending checkout transaction. Only works for transactions that have not been completed.",
      annotations: { readOnlyHint: false, destructiveHint: true },
      inputSchema: {
        orderReference: z
          .string()
          .describe("The order reference of the transaction to cancel"),
      },
    },
    async ({ orderReference }) => {
      logToolCall("nomba_cancel_transaction", { orderReference });
      try {
        const result = await client.post(
          "/v1/checkout/cancel-transaction",
          { orderReference }
        );
        return jsonResponse(result);
      } catch (error) {
        return errorResponse(error);
      }
    }
  );
}
