import { Outlet } from "react-router-dom";
import Navbar from "./Navbar";
import Sidebar from "./Sidebar";

export default function Layout() {
  return (
    <div className="h-dvh flex flex-col">
      <Navbar />
      <div className="flex flex-1 min-h-0 -mt-px">
        <Sidebar />
        <main className="flex-1 bg-gray-50 overflow-auto p-4 md:p-6 -mt-px">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
