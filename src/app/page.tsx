import Link from 'next/link';

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
      <h1 className="text-4xl font-bold text-gray-800 mb-4">Welcome to Finance Tracker</h1>
      <p className="text-lg text-gray-600 mb-6 text-center max-w-xl">
        Take control of your finances. Track your income, monitor expenses, and reach your goals — all in one place.
      </p>
      <Link
        href="/dashboard"
        className="px-6 py-3 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
      >
        Get Started
      </Link>
    </main>
  );
}
