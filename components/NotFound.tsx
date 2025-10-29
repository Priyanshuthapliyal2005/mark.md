"use client";

import { useRouter } from "next/navigation";

const NotFound = () => {
    const router = useRouter();

    return (
        <div className="flex min-h-screen items-center justify-center bg-gray-100">
            <div className="text-center">
                <h1 className="mb-4 text-4xl font-bold">404</h1>
                <p className="mb-4 text-xl text-gray-600">Oops! The requested page was not found.</p>
                <button onClick={() => router.push("/")} className="text-blue-500 underline hover:text-blue-700">Return to Home</button>
            </div>
        </div>
    );
};

export default NotFound;