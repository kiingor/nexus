'use client'

type TypeFilter = 'all' | 'instruction' | 'error'
type StatusFilter = 'all' | 'active' | 'inactive'
type SortField = 'title' | 'created_at' | 'updated_at'
type SortDir = 'asc' | 'desc'

interface KnowledgeItemsFilterProps {
  search: string
  onSearchChange: (value: string) => void
  typeFilter: TypeFilter
  onTypeFilterChange: (value: TypeFilter) => void
  statusFilter: StatusFilter
  onStatusFilterChange: (value: StatusFilter) => void
  sortField: SortField
  onSortFieldChange: (field: SortField) => void
  sortDir: SortDir
  onSortDirChange: (dir: SortDir) => void
  resultCount: number
  totalCount: number
}

const typeOptions: { value: TypeFilter; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'instruction', label: 'Instrução' },
  { value: 'error', label: 'Erro' },
]

const statusOptions: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'active', label: 'Ativos' },
  { value: 'inactive', label: 'Inativos' },
]

const sortLabels: Record<SortField, string> = {
  title: 'Título',
  created_at: 'Criação',
  updated_at: 'Atualização',
}

const toggleBase = 'inline-flex items-center gap-1.5 h-8 px-3 rounded-xl text-xs font-medium transition-all duration-200 cursor-pointer'
const toggleActive = 'bg-[rgba(255,107,0,0.12)] text-[#FF8533] border border-[rgba(255,107,0,0.25)]'
const toggleInactive = 'bg-[rgba(255,255,255,0.04)] text-[#8A8A85] border border-[rgba(255,255,255,0.08)] hover:border-[rgba(255,255,255,0.14)] hover:text-[#F5F5F0]'

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  )
}

function XIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  )
}

function SortAscIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="m3 8 4-4 4 4M7 4v16M11 12h4M11 16h7M11 20h10" />
    </svg>
  )
}

function SortDescIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="m3 16 4 4 4-4M7 20V4M11 4h10M11 8h7M11 12h4" />
    </svg>
  )
}

export function KnowledgeItemsFilter({
  search,
  onSearchChange,
  typeFilter,
  onTypeFilterChange,
  statusFilter,
  onStatusFilterChange,
  sortField,
  onSortFieldChange,
  sortDir,
  onSortDirChange,
  resultCount,
  totalCount,
}: KnowledgeItemsFilterProps) {
  const hasActiveFilters = search !== '' || typeFilter !== 'all' || statusFilter !== 'all'
  const isFiltered = resultCount !== totalCount

  function handleSortToggle(field: SortField) {
    if (sortField === field) {
      onSortDirChange(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      onSortFieldChange(field)
      onSortDirChange(field === 'title' ? 'asc' : 'desc')
    }
  }

  function clearFilters() {
    onSearchChange('')
    onTypeFilterChange('all')
    onStatusFilterChange('all')
  }

  return (
    <div className="mb-6 space-y-3">
      {/* Search + Sort */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#4A4A48] pointer-events-none">
            <SearchIcon />
          </span>
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Buscar por título, conteúdo ou palavras-chave..."
            className="w-full h-10 pl-10 pr-9 rounded-xl text-sm text-[#F5F5F0] bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] placeholder:text-[#4A4A48] outline-none transition-all duration-200 focus:border-[rgba(255,107,0,0.5)] focus:bg-[rgba(255,255,255,0.06)] focus:shadow-[0_0_0_3px_rgba(255,107,0,0.12)] hover:border-[rgba(255,255,255,0.14)]"
          />
          {search && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#4A4A48] hover:text-[#8A8A85] transition-colors"
            >
              <XIcon size={14} />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {(Object.keys(sortLabels) as SortField[]).map((field) => {
            const active = sortField === field
            return (
              <button
                key={field}
                onClick={() => handleSortToggle(field)}
                className={`${toggleBase} ${active ? toggleActive : toggleInactive}`}
              >
                {sortLabels[field]}
                {active && (sortDir === 'asc' ? <SortAscIcon /> : <SortDescIcon />)}
              </button>
            )
          })}
        </div>
      </div>

      {/* Type + Status filters */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-[#4A4A48] mr-1">Tipo:</span>
          {typeOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onTypeFilterChange(opt.value)}
              className={`${toggleBase} ${typeFilter === opt.value ? toggleActive : toggleInactive}`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-xs text-[#4A4A48] mr-1">Status:</span>
          {statusOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onStatusFilterChange(opt.value)}
              className={`${toggleBase} ${statusFilter === opt.value ? toggleActive : toggleInactive}`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="inline-flex items-center gap-1 text-xs text-[#8A8A85] hover:text-[#F5F5F0] transition-colors cursor-pointer"
          >
            <XIcon size={12} />
            Limpar filtros
          </button>
        )}
      </div>

      {/* Results info */}
      {isFiltered && (
        <p className="text-xs text-[#4A4A48]">
          {resultCount === 0
            ? 'Nenhum item encontrado'
            : `${resultCount} de ${totalCount} ite${totalCount !== 1 ? 'ns' : 'm'}`}
        </p>
      )}
    </div>
  )
}
