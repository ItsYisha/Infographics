import './Breadcrumb.css';

export default function Breadcrumb({ pages, currentIndex, onNavigate }) {
  if (!pages.length) return null;

  return (
    <nav className="breadcrumb">
      <button className="breadcrumb-home" onClick={() => onNavigate(-1)} title="Back to home">
        ⌂
      </button>

      {pages.slice(0, currentIndex + 1).map((page, i) => {
        const title = i === 0 ? (page.query || 'Home') : (page.label || `Layer ${i + 1}`);
        const isActive = i === currentIndex;
        return (
          <span key={page.id} className="breadcrumb-segment">
            <span className="breadcrumb-sep">›</span>
            <button
              className={`breadcrumb-item${isActive ? ' active' : ''}${i === 0 ? ' root' : ''}`}
              onClick={() => !isActive && onNavigate(i)}
              disabled={isActive}
              title={title}
            >
              {title}
            </button>
          </span>
        );
      })}
    </nav>
  );
}
