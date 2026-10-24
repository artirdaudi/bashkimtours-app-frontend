export default function FuelTruckIcon({ size = 17, ...props }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
    <rect x="2" y="5" width="12" height="10" rx="4" />
    <path d="M14 9h4l3 3v5h-2" />
    <path d="M2 15v2h2m6 0h5" />
    <circle cx="7" cy="17" r="2" />
    <circle cx="17" cy="17" r="2" />
    <path d="M8 8c-.7 1-1 1.5-1 2a1 1 0 0 0 2 0c0-.5-.3-1-1-2Z" fill="currentColor" stroke="none" />
  </svg>;
}
