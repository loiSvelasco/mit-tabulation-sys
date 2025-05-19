'use client'
import { Button } from '@/components/ui/button';
import { authClient } from '@/lib/auth-client';
import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react';
import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';

const Navbar = () => {
	// const [isdark, setIsdark] = useState(
	// 	//@ts-ignore
	// 	JSON.parse(localStorage.getItem('isdark'))
	// );
	// useEffect(() => {
	// 	localStorage.setItem('isdark', JSON.stringify(isdark));
	// }, [isdark]);

	const { data: session } = authClient.useSession();
	const router = useRouter();

	const handleLogout = async () => {
		await authClient.signOut({
			fetchOptions: {
				onSuccess: () => {
					setTimeout(() => {
						router.replace("/auth");
					}, 2000);
				}
			}
		});
		toast.success("Logged out.")
		// router.replace("/auth"); // Ensure correct redirection
	};

	// if (isPending) {
	// 	return <div>Loading...</div>; // Prevents hook mismatches
	// }

	return (
		<div className="navbar bg-base-100">
			<div className="flex-1">
				<img src="/tabulation_logo.svg" className="ml-4 w-8" alt="" />
				<a className="text-xl ml-4"><strong>rankx</strong> - an advanced Tabulation System</a>
			</div>
			<div className="flex-none gap-2">
				<Button type="button" variant="outline" onClick={handleLogout}>
					<LogOut /> Sign Out
				</Button>

				{/* <label className="flex cursor-pointer gap-2">
				<svg
							xmlns="http://www.w3.org/2000/svg"
							width="20"
							height="20"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="2"
							strokeLinecap="round"
							strokeLinejoin="round">
							<circle cx="12" cy="12" r="5" />
							<path
							d="M12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" />
						</svg>
					<input type="checkbox" checked={isdark} onChange={() => setIsdark(!isdark)} value="dark" className="toggle theme-controller" />
					<svg
							xmlns="http://www.w3.org/2000/svg"
							width="20"
							height="20"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="2"
							strokeLinecap="round"
							strokeLinejoin="round">
							<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
						</svg>
				</label> */}

				{/* <div className="dropdown dropdown-end mr-4">
					<div tabIndex={0} role="button" className="btn btn-ghost btn-circle avatar">
						<div className="w-10 rounded-full">
							<img alt="User Profile" src={session?.user?.image || "https://img.daisyui.com/images/stock/photo-1534528741775-53994a69daeb.webp"} />
						</div>
					</div>
				</div> */}
			</div>
		</div>
	);
}

export default Navbar;
