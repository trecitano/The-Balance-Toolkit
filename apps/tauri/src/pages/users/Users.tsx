import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import "./Users.css";
import { commands } from "@/utils/requests";
import { UsersQuery, refreshUsers } from "@/queries/toolkit";
import { ToolkitButton } from "@/components/ToolkitButton";
import PageTitle from "@/components/PageTitle";
import { QueryStatus } from "@/components/QueryStatus";
import { useConfirm } from "@/hooks/useConfirm";
import { useAction } from "@/hooks/useAction";
import searchIcon from "@/assets/search-icon.svg";
import PersonIcon from "@/assets/user-icon.svg?react";
import UserCarousel from "./UserCarousel";
import UserEditor from "./UserEditor";

export default function Users() {
  const query = useQuery(UsersQuery);
  const client = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [createdId, setCreatedId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const { confirm, ConfirmDialog } = useConfirm();
  const action = useAction(() => refreshUsers(client));
  const users = query.data?.users ?? [];
  const searchQuery = search.trim().toLowerCase();
  const searchResults = users.filter(
    (user) => user.name.toLowerCase().includes(searchQuery) || String(user.id).includes(searchQuery),
  );
  const selected =
    users.find((user) => user.id === query.data?.selectedUserId) ?? users.find((user) => user.isDefault) ?? users[0];
  const busy = action.isPending || saving;
  const discard = async () =>
    !editing ||
    (await confirm({
      title: "Unsaved changes",
      message: "Discard your edits and switch users?",
      confirmText: "Discard changes",
      cancelText: "Keep editing",
    }));
  const select = async (id: number) => {
    if (busy) return;
    if (selected?.id === id) {
      setSearch("");
      setSearchOpen(false);
      return;
    }
    if (!(await discard())) return;
    action.run(async () => {
      await commands.users.selectUser(id);
      setEditing(false);
      setCreatedId(null);
      setSearch("");
      setSearchOpen(false);
    });
  };
  if (query.isPending || (!query.data && query.error))
    return <QueryStatus pending={query.isPending} error={query.error} onRetry={() => void query.refetch()} />;
  return (
    <div className="flex h-full flex-col gap-5">
      <header className="relative grid grid-cols-7 items-center gap-x-4">
        <PageTitle>Users</PageTitle>
        <ToolkitButton
          type="button"
          color="blue"
          className="max-w-35"
          disabled={busy}
          onClick={async () => {
            if (!(await discard())) return;
            action.run(async () => {
              const user = await commands.users.createUser();
              await commands.users.selectUser(user.id);
              setCreatedId(user.id);
              setEditing(true);
            });
          }}
        >
          Create user
        </ToolkitButton>
        <div
          className="absolute top-1/2 left-1/2 z-10 w-2/7 -translate-x-1/2 -translate-y-1/2"
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) setSearchOpen(false);
          }}
        >
          <img
            src={searchIcon}
            alt=""
            className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 opacity-70"
          />
          <input
            type="search"
            aria-label="Search users by name or ID"
            placeholder="Search by name or ID…"
            value={search}
            onFocus={() => setSearchOpen(true)}
            onChange={(event) => {
              setSearch(event.target.value);
              setSearchOpen(true);
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                setSearch("");
                setSearchOpen(false);
              } else if (event.key === "Enter" && searchQuery && searchResults[0]) {
                event.preventDefault();
                void select(searchResults[0].id);
              } else if (event.key === "ArrowDown") {
                event.preventDefault();
                event.currentTarget.parentElement?.querySelector<HTMLButtonElement>("li button")?.focus();
              }
            }}
            className="w-full rounded-lg bg-white px-10 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-200"
          />
          {searchOpen && searchQuery && (
            <div className="absolute top-full left-0 mt-2 max-h-50 w-full overflow-y-auto rounded-lg bg-white shadow-lg">
              {searchResults.length ? (
                <ul aria-label="User search results">
                  {searchResults.map((user) => (
                    <li key={user.id}>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void select(user.id)}
                        className="flex w-full items-center gap-2 border-b border-gray-200 px-3 py-2 text-left hover:bg-blue-50 focus-visible:bg-blue-50"
                      >
                        <span
                          className="flex size-6 shrink-0 items-center justify-center rounded-full"
                          style={{ backgroundColor: user.color ?? "#999" }}
                        >
                          <PersonIcon className="size-4 text-white" />
                        </span>
                        <span className="min-w-0 truncate font-semibold">{user.name}</span>
                        <span className="ml-auto shrink-0 text-xs text-gray-500">ID {user.id}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p role="status" className="p-3 text-center text-sm text-gray-500 italic">
                  No users found
                </p>
              )}
            </div>
          )}
        </div>
      </header>
      <QueryStatus error={action.error || query.error} />
      {selected ? (
        <>
          <UserCarousel
            users={users}
            selectedId={selected.id}
            disabled={busy}
            editing={editing}
            onSelect={(id) => void select(id)}
          />
          <UserEditor
            key={selected.id}
            user={selected}
            initialEditing={createdId === selected.id}
            onSavingChange={setSaving}
            onEditingChange={(next) => {
              setEditing(next);
              if (!next) setCreatedId(null);
            }}
            disabled={busy}
            sessionDevices={query.data?.sessionDevices ?? []}
            onDelete={async () => {
              if (
                !(await confirm({
                  title: "Delete user",
                  message: `Delete ${selected.name}? This also discards any unsaved edits.`,
                  confirmText: "Delete",
                  confirmColor: "red",
                }))
              )
                return;
              action.run(async () => {
                await commands.users.deleteUser(selected.id);
                setEditing(false);
                setCreatedId(null);
              });
            }}
          />
        </>
      ) : (
        <QueryStatus empty="No users are available. Create a user to begin." />
      )}
      {ConfirmDialog}
    </div>
  );
}
