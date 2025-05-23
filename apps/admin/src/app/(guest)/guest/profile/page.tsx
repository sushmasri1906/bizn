"use client";
import { signOut } from "next-auth/react";
import React from "react";
import ProfilePage from "../../../../components/common/ProfilePage";

const page = () => {
	return (
		<div>
			<button onClick={() => signOut()}>Signout</button>
			<div>
				<ProfilePage />
			</div>
		</div>
	);
};

export default page;
