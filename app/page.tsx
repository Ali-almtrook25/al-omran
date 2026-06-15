import Link from 'next/link';

export default function HomePage() {
	return (
		<div className="mx-auto flex min-h-[calc(100vh-64px)] w-full max-w-4xl flex-col justify-center gap-6 px-6 py-10">
			<h1 className="text-3xl font-bold text-slate-900 sm:text-4xl">Operations Dashboard</h1>
			<p className="max-w-2xl text-slate-600">
				Use one of the tools below to view Zift data or run the coupon discount update workflow.
			</p>

			<div className="flex flex-col gap-3 sm:flex-row">
				<Link
					href="/zift"
					className="rounded-lg bg-slate-900 px-5 py-3 text-center font-medium text-white transition hover:bg-slate-700"
				>
					Open Zift Data Viewer
				</Link>
				<Link
					href="/ziftUpdate"
					className="rounded-lg border border-slate-300 bg-white px-5 py-3 text-center font-medium text-slate-700 transition hover:bg-slate-50"
				>
					Open Zift Update
				</Link>
			</div>
		</div>
	);
}
