'use client';

import * as React from 'react';
import ComboBox, { ComboboxOption } from '@/components/Combobox';
import Paper from '@/components/Paper';

interface GuildAdminFormProps {
  roles: ComboboxOption[];
  initialAllowedRoles: string[];
}

export default function GuildAdminForm({ roles, initialAllowedRoles }: GuildAdminFormProps) {
  const [selectedRoles, setSelectedRoles] = React.useState<ComboboxOption[]>(
    roles.filter((role) => initialAllowedRoles.includes(role.id as string)),
  );

  return (
    <Paper>
      <div className="flex flex-col gap-2">
        <label htmlFor="allowed-roles" className="text-sm font-medium text-sage-12">
          Allowed Roles
        </label>
        <p className="text-sm text-sage-11">
          Select the roles that are allowed to access Tavern Master features in this guild. Guild
          administrators always have access.
        </p>
        <ComboBox
          items={roles}
          multiple
          value={selectedRoles}
          placeholder="Select roles..."
          onValueChange={(values) => {
            setSelectedRoles(values as ComboboxOption[]);
            console.log('Selected roles:', values);
            // Saving not implemented yet per instructions
          }}
        />
      </div>
    </Paper>
  );
}
