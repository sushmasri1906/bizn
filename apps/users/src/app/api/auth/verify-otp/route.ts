import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs"; // Import bcrypt
import prisma from "@repo/db/client"; // Prisma client

const OTP_SECRET = process.env.OTP_SECRET || "supersecret";

export async function POST(req: Request) {
	try {
		const { email, otp, token, password, firstname, lastname, phone } =
			await req.json();

		if (
			!email ||
			!otp ||
			!token ||
			!password ||
			firstname ||
			lastname ||
			phone
		) {
			return NextResponse.json({
				success: false,
				message: "All fields are required!",
			});
		}

		// Verify the JWT token
		const decoded = jwt.verify(token, OTP_SECRET) as {
			email: string;
			otp: string;
		};

		if (decoded.email !== email || decoded.otp !== otp) {
			return NextResponse.json({ success: false, message: "Invalid OTP!" });
		}

		// Hash the password before storing it
		const hashedPassword = await bcrypt.hash(password, 10); // 10 is the salt rounds
		// Upsert user (update if exists, otherwise create)
		await prisma.user.upsert({
			where: { email },
			update: { emailVerified: true, password: hashedPassword },
			create: {
				email,
				emailVerified: true,
				password: hashedPassword,
				phone: phone,
				firstname: firstname as string,
				lastname: lastname,
				membershipStartDate: new Date(),
				membershipEndDate: new Date(
					new Date().setFullYear(new Date().getFullYear() + 1)
				),
			},
		});

		return NextResponse.json({ success: true, message: "Email verified!" });
	} catch (error) {
		console.error("Error verifying email:", error);
		return NextResponse.json({
			success: false,
			error: "OTP expired or invalid!",
		});
	}
}
