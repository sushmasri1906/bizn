// import  {Cashfree}  from "cashfree-pg";
// import dotenv from "dotenv"

// dotenv.config()

// Cashfree.XClientId = {process.env.X_CLIENT_ID};
// Cashfree.XClientSecret = {process.env.X_CLIENT_SECRET};
// Cashfree.XEnvironment = Cashfree.Environment.PRODUCTION;

// function createOrder() {
//   var request = {
//     "order_amount": "1",
//     "order_currency": "INR",
//     "customer_details": {
//       "customer_id": "node_sdk_test",
//       "customer_name": "",
//       "customer_email": "example@gmail.com",
//       "customer_phone": "9999999999"
//     },
//     "order_meta": {
//       "return_url": "https://test.cashfree.com/pgappsdemos/return.php?order_id=order_123"
//     },
//     "order_note": ""
//   }

//   Cashfree.PGCreateOrder("2023-08-01", request).then((response) => {
//     var a = response.data;
//     console.log(a)
//   })
//     .catch((error) => {
//       console.error('Error setting up order request:', error.response.data);
//     });
// }

// order.ts
// This file represents the Node.js utility/microservice responsible for
// creating an order with the Cashfree Payments API.

import axios, { AxiosError } from "axios";
import crypto from "crypto"; // For generating a unique order ID
import dotenv from "dotenv";

import path from "path";

// Load environment variables from .env file (especially for local development)
dotenv.config({ path: path.resolve(__dirname, "../.env") });

// --- Configuration ---
// Retrieve Cashfree API credentials and endpoint from environment variables
// IMPORTANT: Store these securely, never hardcode them directly in the code.
const CASHFREE_API_ENDPOINT = process.env.CASHFREE_API_ENDPOINT; // e.g., 'https://sandbox.cashfree.com/pg' or 'https://api.cashfree.com/pg'
const CASHFREE_APP_ID = process.env.CASHFREE_APP_ID;
const CASHFREE_SECRET_KEY = process.env.CASHFREE_SECRET_KEY;
// Specify the Cashfree API version you intend to use
const CASHFREE_API_VERSION = "2023-08-01"; // Use the latest appropriate version

// --- Type Definitions ---

interface CustomerDetails {
	customer_id: string; // Unique ID for the customer in your system
	customer_email: string;
	customer_phone: string;
	customer_name?: string; // Optional but recommended
}

// Input parameters expected by our createOrder function/endpoint
interface CreateOrderInput {
	order_amount: number;
	order_currency: string; // e.g., "INR"
	customer_details: CustomerDetails;
	return_url: string; // URL to redirect user back to after payment attempt
	order_note?: string; // Optional note
	// Add any other fields required by your application logic
}

// Structure for a successful response from this utility
interface CreateOrderSuccessResponse {
	success: true;
	payment_session_id: string;
	order_id: string; // The unique order_id generated by this utility
	cf_order_id: number; // Cashfree's internal order ID
	order_status: string; // e.g., "ACTIVE"
}

// Structure for an error response from this utility
interface CreateOrderErrorResponse {
	success: false;
	error_message: string;
	error_details?: any; // Optional: include details from Cashfree or Axios error
}

// Combined type for the function's return value
type CreateOrderResponse =
	| CreateOrderSuccessResponse
	| CreateOrderErrorResponse;

/**
 * Generates a unique order ID.
 * Example: Using crypto module for a UUID-like structure.
 */
function generateOrderId(): string {
	// You can customize this logic. Using randomUUID is generally good.
	// Ensure it meets any length/format requirements if Cashfree has them.
	return crypto.randomUUID();
}

/**
 * Core function to create an order with Cashfree Payments API.
 * @param input - The order details received from the calling service (e.g., Next.js backend).
 * @returns A promise resolving to CreateOrderResponse indicating success or failure.
 */
export const createCashfreeOrder = async (
	input: CreateOrderInput
): Promise<CreateOrderResponse> => {
	// --- Validation ---
	if (!CASHFREE_API_ENDPOINT || !CASHFREE_APP_ID || !CASHFREE_SECRET_KEY) {
		console.error(
			"Cashfree API credentials or endpoint not configured in environment variables."
		);
		return {
			success: false,
			error_message:
				"Server configuration error: Payment gateway details missing.",
		};
	}

	if (
		!input ||
		!input.order_amount ||
		!input.order_currency ||
		!input.customer_details ||
		!input.return_url
	) {
		return {
			success: false,
			error_message: "Missing required order parameters.",
		};
	}

	const orderId = generateOrderId();
	const apiUrl = `${CASHFREE_API_ENDPOINT}/orders`;

	// --- Prepare Cashfree Request ---
	const requestBody = {
		order_id: orderId,
		order_amount: input.order_amount,
		order_currency: input.order_currency,
		customer_details: input.customer_details,
		order_meta: {
			return_url: input.return_url + `/${orderId}`,
			notify_url: process.env.CASHFREE_WEBHOOK_URL, // Optional: Can be set here or globally in dashboard
		},
		order_note: input.order_note || `Order ${orderId}`,
		// order_tags: { // Optional tags
		//   source: "nodejs_utility"
		// }
	};

	const headers = {
		"Content-Type": "application/json",
		"x-api-version": CASHFREE_API_VERSION,
		"x-client-id": CASHFREE_APP_ID,
		"x-client-secret": CASHFREE_SECRET_KEY,
	};

	// --- Make API Call ---
	console.log(`Attempting to create Cashfree order ${orderId}...`);
	try {
		const response = await axios.post(apiUrl, requestBody, { headers });

		// --- Handle Success Response ---
		console.log(`Cashfree order ${orderId} created successfully.`);
		// Log only necessary info, avoid logging sensitive response parts if any
		// console.log("Cashfree Response Status:", response.status);
		// console.log("Cashfree Response Data:", response.data);

		// Check if the response structure is as expected
		if (
			response.data &&
			response.data.payment_session_id &&
			response.data.cf_order_id &&
			response.data.order_status
		) {
			console.log(response.data);

			return {
				success: true,
				payment_session_id: response.data.payment_session_id,
				order_id: response.data.order_id, // Cashfree returns the same order_id you sent
				cf_order_id: response.data.cf_order_id,
				order_status: response.data.order_status,
			};
		} else {
			console.error("Cashfree response structure unexpected:", response.data);
			return {
				success: false,
				error_message:
					"Failed to create order: Unexpected response format from payment gateway.",
				error_details: response.data,
			};
		}
	} catch (error) {
		// --- Handle Error Response ---
		console.error(`Error creating Cashfree order ${orderId}:`, error);

		let errorMessage = "Failed to create order due to an unexpected error.";
		let errorDetails: any = null;

		if (axios.isAxiosError(error)) {
			const axiosError = error as AxiosError;
			errorMessage = `Failed to communicate with payment gateway: ${axiosError.message}`;
			if (axiosError.response) {
				// Cashfree API returned an error (e.g., 4xx, 5xx)
				console.error("Cashfree Error Status:", axiosError.response.status);
				console.error("Cashfree Error Data:", axiosError.response.data);
				errorMessage = `Payment gateway error: ${axiosError.response.status}`;
				errorDetails = axiosError.response.data; // Contains Cashfree specific error message, code, type

				// Try to extract a more specific message if available
				if (
					typeof errorDetails === "object" &&
					errorDetails !== null &&
					errorDetails.message
				) {
					errorMessage = `Payment gateway error: ${errorDetails.message}`;
				}
			} else if (axiosError.request) {
				// Request was made but no response received
				errorMessage = "No response received from payment gateway.";
			}
		}

		return {
			success: false,
			error_message: errorMessage,
			error_details: errorDetails,
		};
	}
};

// --- Optional: Example of exposing this function via an Express API endpoint ---
/*
import express, { Request, Response } from 'express';

const app = express();
const port = process.env.PORT || 3001; // Port for this utility service

app.use(express.json()); // Middleware to parse JSON bodies

// Define an endpoint that the Next.js backend can call
app.post('/create-order', async (req: Request, res: Response) => {
    console.log("Received request body:", req.body); // Log received data for debugging

    // Basic validation of input structure
    const inputData = req.body as CreateOrderInput;
    if (!inputData || typeof inputData !== 'object') {
        return res.status(400).json({ success: false, error_message: "Invalid request body." });
    }

    // Call the core order creation logic
    const result = await createCashfreeOrder(inputData);

    // Send the result back to the caller (Next.js backend)
    if (result.success) {
        res.status(200).json(result);
    } else {
        // Determine appropriate status code based on error type if needed
        // For now, using 500 for server-side/gateway issues, 400 might be suitable for bad input handled inside createCashfreeOrder
        res.status(500).json(result);
    }
});

// Basic health check endpoint
app.get('/health', (req: Request, res: Response) => {
    res.status(200).send('OK');
});


// Start the server only if CASHFREE variables are set
if (CASHFREE_API_ENDPOINT && CASHFREE_APP_ID && CASHFREE_SECRET_KEY) {
    app.listen(port, () => {
        console.log(`Node.js Cashfree utility service listening on port ${port}`);
        console.log(`Cashfree API Endpoint configured: ${CASHFREE_API_ENDPOINT}`);
    });
} else {
     console.error("FATAL: Cashfree environment variables not set. Server not starting.");
     // process.exit(1); // Exit if critical config is missing
}

*/

// If not using Express, you might export the function directly:
// export { createCashfreeOrder };
