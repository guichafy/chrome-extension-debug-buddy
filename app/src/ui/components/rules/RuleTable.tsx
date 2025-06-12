import React from 'react';
import { Rule } from '@/backend/types/rules';
import { DataTable } from './rule-data-table';
import { columns } from './rule-columns';

interface RuleTableProps {
	rules: Rule[];
	onRemove: (id: string) => void;
	onToggle?: (id: string) => Promise<boolean>;
	onEdit?: (rule: Rule) => void;
}

const RuleTable: React.FC<RuleTableProps> = ({ rules, onRemove, onToggle, onEdit }) => {
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

export default RuleTable;
