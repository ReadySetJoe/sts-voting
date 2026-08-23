import AdminGroupPanel from "@/components/AdminGroupPanel";

export default function AdminPage() {
  return (
    <div className="min-h-screen bg-gray-900 p-8 text-white">
      <h1 className="mb-8 text-3xl font-bold">STS Panel Voting — Admin</h1>
      <div className="grid gap-8 md:grid-cols-2">
        <AdminGroupPanel group="heroes" />
        <AdminGroupPanel group="villains" />
      </div>
    </div>
  );
}
