const TabBar = ({ tabs, active, onChange }) => (
  <nav className="tab-bar">
    {tabs.map((t) => (
      <button
        key={t.id}
        className={`tab-bar__tab ${active === t.id ? "tab-bar__tab--active" : ""}`}
        onClick={() => onChange(t.id)}
      >
        {t.label}
      </button>
    ))}
  </nav>
);

export default TabBar;
