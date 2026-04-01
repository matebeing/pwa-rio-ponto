import { memo, useMemo, useState } from 'react';
import { IconSearch, IconX } from '../Icons';
import './styles.css';

type SearchProps = {
  allLines: string[];
  allOrdens: string[];
  lineColorMap: Map<string, string>;
  selectedLines: string[];
  onSelectLines?: (lines: string[]) => void;
  onSearchOrdem?: (ordem: string | null) => void;
};

const MAX_SELECTED = 5;

const Search = memo(function Search({
  allLines,
  allOrdens,
  lineColorMap,
  selectedLines,
  onSelectLines,
  onSearchOrdem,
}: SearchProps) {
  const [input, setInput] = useState('');
  const [focused, setFocused] = useState(false);

  const isOrdemSearch = useMemo(() => {
    if (!input) return false;
    return /^[A-Za-z]\d/i.test(input.trim());
  }, [input]);

  const filteredLines = useMemo(
    () => (input && !isOrdemSearch
      ? allLines.filter((l) => l.toLowerCase().includes(input.toLowerCase()))
      : allLines),
    [input, allLines, isOrdemSearch],
  );

  const filteredOrdens = useMemo(
    () => (input && isOrdemSearch
      ? allOrdens.filter((o) => o.toLowerCase().includes(input.toLowerCase()))
      : []),
    [input, allOrdens, isOrdemSearch],
  );

  const handleAddLine = (line: string) => {
    if (selectedLines.includes(line) || selectedLines.length >= MAX_SELECTED) return;
    const next = [...selectedLines, line];
    onSelectLines?.(next);
    onSearchOrdem?.(null);
    setInput('');
  };

  const handleRemoveLine = (line: string) => {
    const next = selectedLines.filter((l) => l !== line);
    onSelectLines?.(next);
  };

  const handleSelectOrdem = (ordem: string) => {
    onSearchOrdem?.(ordem);
    setInput('');
  };

  const showDropdown = input.length > 0;

  return (
    <div className="search-bar-area">
      <div className={`search-bar ${focused ? 'focused' : ''}`}>
        <IconSearch size={18} color="var(--text-3)" />
        <input
          className="search-bar-input"
          type="text"
          placeholder="Linha ou veículo…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              if (isOrdemSearch && filteredOrdens[0]) handleSelectOrdem(filteredOrdens[0]);
              else if (!isOrdemSearch && filteredLines[0]) handleAddLine(filteredLines[0]);
            }
          }}
          id="search-input"
        />
        {input && (
          <button className="search-bar-clear" onClick={() => setInput('')}>
            <IconX size={14} color="var(--text-3)" />
          </button>
        )}
      </div>

      {/* Selected tags */}
      {selectedLines.length > 0 && (
        <div className="search-chips">
          {selectedLines.map((line) => {
            const color = lineColorMap.get(line) ?? 'var(--text-3)';
            return (
              <button
                key={line}
                className="search-chip"
                style={{ '--chip-color': color } as React.CSSProperties}
                onClick={() => handleRemoveLine(line)}
              >
                <span className="search-chip-dot" style={{ background: color }} />
                {line}
                <IconX size={12} color={color} />
              </button>
            );
          })}
        </div>
      )}

      {/* Dropdown */}
      {showDropdown && (
        <div className="search-results">
          {allLines.length === 0 && allOrdens.length === 0 ? (
            <div className="search-results-empty">Carregando sistema GPS...</div>
          ) : isOrdemSearch ? (
            <>
              <div className="search-results-hint">Buscando veículo…</div>
              {filteredOrdens.slice(0, 8).map((ordem, i) => (
                <button
                  key={ordem}
                  className="search-result-item"
                  style={{ animationDelay: `${i * 35}ms` }}
                  onClick={() => handleSelectOrdem(ordem)}
                >
                  <span className="search-result-icon">🚌</span>
                  <span>{ordem}</span>
                </button>
              ))}
              {filteredOrdens.length === 0 && (
                <div className="search-results-empty">Nenhum veículo encontrado</div>
              )}
            </>
          ) : (
            <>
              {filteredLines.slice(0, 8).map((line, i) => {
                const color = lineColorMap.get(line) ?? 'var(--text-3)';
                return (
                  <button
                    key={line}
                    className="search-result-item"
                    style={{ animationDelay: `${i * 35}ms` }}
                    onClick={() => handleAddLine(line)}
                  >
                    <span className="search-result-dot" style={{ background: color }} />
                    <span>{line}</span>
                  </button>
                );
              })}
              {filteredLines.length === 0 && (
                <div className="search-results-empty">Nenhuma linha encontrada</div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
});

export default Search;