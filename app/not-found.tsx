import { MapPinOff } from "lucide-react";

import { RouteMessage } from "@/components/route-message";

export default function NotFound() {
  return (
    <RouteMessage
      icon={MapPinOff}
      title="We couldn’t find that page"
      href="/"
      linkLabel="Browse stays"
    >
      <p>The link may be mistyped, or the page has moved.</p>
    </RouteMessage>
  );
}
