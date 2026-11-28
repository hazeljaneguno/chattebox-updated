import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Check, Search } from "lucide-react";
import Avatar from "./Avatar.jsx";
import "./AddPeople.css";

function personId(person) {
  return String(person?.id ?? person?._id ?? person?.userId ?? person ?? "");
}

export default function AddPeople({
  members,
  currentUserId,
  canAdd,
  onFindPeople,
  onAdd,
  onClose,
}) {
  const backButton = useRef(null);
  const [search, setSearch] = useState("");
  const [result, setResult] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const query = search.trim();

  useEffect(() => {
    backButton.current?.focus();
  }, []);

  useEffect(() => {
    if (!canAdd || !onFindPeople) return;
    let active = true;

    const timer = setTimeout(async () => {
      try {
        const people = await onFindPeople(query);
        if (active) setResult({ query, people });
      } catch (error) {
        if (active) setResult({ query, error: error.message || "Could not load people." });
      }
    }, 200);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [canAdd, onFindPeople, query]);

  const excluded = new Set(members.map(personId));
  excluded.add(personId(currentUserId));
  const selectedIds = [...selected].filter((id) => !excluded.has(id));
  const currentResult = result?.query === query ? result : null;
  const candidates = (currentResult?.people || []).filter((person) => !excluded.has(personId(person)));

  function togglePerson(id) {
    setSaveError("");
    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function addSelected() {
    if (!canAdd || saving || !selectedIds.length) return;
    setSaving(true);
    setSaveError("");
    try {
      await onAdd(selectedIds);
      onClose();
    } catch (error) {
      setSaveError(error.message || "Could not add people.");
      setSaving(false);
    }
  }

  return (
    <div className="chat-details-backdrop" onClick={(event) => {
      if (!saving && event.target === event.currentTarget) onClose();
    }}>
      <section
        className="chat-details-panel add-people"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-people-heading"
        onKeyDown={(event) => {
          if (event.key === "Escape" && !saving) onClose();
        }}
      >
        <header className="add-people-header">
          <button ref={backButton} className="add-people-back" type="button" aria-label="Back"
            disabled={saving} onClick={onClose}>
            <ArrowLeft size={24} aria-hidden="true" />
          </button>
          <h2 id="add-people-heading">Add people</h2>
          <button className="add-people-submit" type="button"
            disabled={!canAdd || saving || !selectedIds.length} onClick={addSelected}>
            {saving ? "Adding…" : selectedIds.length ? `Add (${selectedIds.length})` : "Add"}
          </button>
        </header>
        {canAdd && (
          <label className="add-people-search">
            <Search size={20} aria-hidden="true" />
            <input type="search" aria-label="Search people" placeholder="Search"
              value={search} readOnly={saving} onChange={(event) => {
                const value = event.target.value;
                if (value.trim() !== query) setResult(null);
                setSearch(value);
              }} />
          </label>
        )}
        {saveError && <p className="add-people-status" role="alert">{saveError}</p>}
        <div className="add-people-list">
          {!canAdd && <p className="add-people-status">Only admins can add people.</p>}
          {canAdd && !currentResult && <p className="add-people-status" role="status">Loading people…</p>}
          {currentResult?.error && <p className="add-people-status" role="alert">{currentResult.error}</p>}
          {canAdd && currentResult?.people && !candidates.length && (
            <p className="add-people-status" role="status">
              {query ? "No matching people found." : "No additional people available."}
            </p>
          )}
          {canAdd && candidates.map((person) => {
            const id = personId(person);
            const name = person.username || person.name || "Member";
            const checked = selected.has(id);
            return (
              <label className="add-people-row" key={id}>
                <Avatar name={name} photo={person.profilePicture} />
                <span className="add-people-name">{name}</span>
                <input type="checkbox" aria-label={name} checked={checked} disabled={saving}
                  onChange={() => togglePerson(id)} />
                <span className="add-people-check" aria-hidden="true">
                  {checked && <Check size={15} strokeWidth={3} />}
                </span>
              </label>
            );
          })}
        </div>
      </section>
    </div>
  );
}
