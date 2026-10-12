import { LogOut } from "lucide-react";

export default function LogoutButton() {
  return (
    <form className="app-logout" action="/api/auth/logout" method="post">
      <button type="submit" aria-label="Logga ut" title="Logga ut">
        <LogOut size={17} aria-hidden="true" />
      </button>
    </form>
  );
}
