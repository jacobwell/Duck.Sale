"use client";
import Link from "next/link";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="error-page">
      <h1>A little off course.</h1>
      <p>
        Something interrupted this page. Your saved searches are still in your
        account.
      </p>
      <button className="primary" onClick={reset}>
        Try again
      </button>
      <Link href="/">Back to Boatduck</Link>
    </main>
  );
}
