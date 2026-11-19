const artwork = {
  flag: <path d="M5 21V4m0 1c5-4 9 4 15 0v10c-6 4-10-4-15 0" />,
  trophy: (
    <path d="M7 3h10v6a5 5 0 0 1-10 0zM7 5H3v2a4 4 0 0 0 4 4m10-6h4v2a4 4 0 0 1-4 4M12 14v5m-4 2h8m-6-2h4" />
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M2 20v-2a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v2M16 5a3 3 0 0 1 0 6m2 3a5 5 0 0 1 4 5" />
    </>
  ),
  lab: (
    <>
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M12 17v4m-5 0h10m-8-14-3 3 3 3m6-6 3 3-3 3" />
    </>
  ),
};

export default function EmptyStateIcon({ name }: { name: keyof typeof artwork }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="mx-auto size-9 text-zinc-500 dark:text-zinc-400"
    >
      {artwork[name]}
    </svg>
  );
}
