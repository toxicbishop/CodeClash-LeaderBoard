import { unauthorized } from 'next/navigation';

export default function UnauthorizedRoutePage() {
  unauthorized();
}
