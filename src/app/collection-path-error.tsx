import { COLLECTION_PATH_VARIABLE, DEFAULT_COLLECTION_FOLDER } from "./collection-path-names";

export function CollectionPathErrorPage({ message }: { message: string }) {
  return (
    <div className="min-h-screen w-full bg-neutral-50 px-6 py-16 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      <main className="mx-auto max-w-3xl rounded-xl border border-red-200 bg-white p-8 shadow-sm dark:border-red-900 dark:bg-neutral-900">
        <h1 className="text-2xl font-bold">The app cannot read the Collection</h1>
        <p className="mt-4">{message}</p>
        <p className="mt-4">
          Put your Notes in the <code className="font-mono font-semibold">{DEFAULT_COLLECTION_FOLDER}</code> folder
          of the project. Or set <code className="font-mono font-semibold">{COLLECTION_PATH_VARIABLE}</code> in{" "}
          <code className="font-mono">.env.local</code> to the absolute path of your Collection folder, and restart the
          app. See <code className="font-mono">.env.example</code>.
        </p>
      </main>
    </div>
  );
}
