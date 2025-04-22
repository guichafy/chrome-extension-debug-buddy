import React from 'react';
import { UrlPattern } from '../hooks/useUrlPatterns';
import { DataTable } from './rules/data-table';
import { columns, Rule } from './rules/columns';

interface RuleListProps {
  urlPatterns: (string | UrlPattern)[];
  onRemove: (index: number) => void;
  onToggle?: (index: number) => Promise<boolean>;
  onEdit?: (index: number, rule: UrlPattern) => Promise<boolean>;
}

const RuleList: React.FC<RuleListProps> = ({
  urlPatterns,
  onRemove,
  onToggle,
  onEdit
}) => {
  // Converter urlPatterns para o formato esperado pelo DataTable
  const rules: Rule[] = urlPatterns;

  return (
    <DataTable
      columns={columns}
      data={rules}
      onRemove={onRemove}
      onToggle={onToggle}
      onEdit={onEdit}
    />
  );
};

export default RuleList;
