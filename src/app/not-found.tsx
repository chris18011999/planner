import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full bg-neutral-50 px-6 py-16 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      <main className="mx-auto max-w-3xl rounded-xl border border-neutral-200 bg-white p-8 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        <h1 className="text-2xl font-bold">Not found</h1>
        <p className="mt-4">No Note in the Collection matches this URL.</p>
        <Link href="/" className="mt-6 inline-block text-violet-600 hover:underline dark:text-violet-400">
          ← All notes
        </Link>
      </main>
    </div>
  );
}
