import React, { memo, useMemo, useRef, useEffect } from 'react';
import * as Ariakit from '@ariakit/react';
import { ChevronDown } from 'lucide-react';
import { PermissionTypes, Permissions } from 'librechat-data-provider';
import { TooltipAnchor } from '@librechat/client';
import MCPServerMenuItem from '~/components/MCP/MCPServerMenuItem';
import MCPConfigDialog from '~/components/MCP/MCPConfigDialog';
import StackedMCPIcons from '~/components/MCP/StackedMCPIcons';
import { useHasAccess, useLocalize } from '~/hooks';
import { useBadgeRowContext } from '~/Providers';
import { cn } from '~/utils';

interface MCPSelectProps {
  /** Show every server with its connection status instead of a selection (agents have fixed tools).
   *  Clicking a disconnected server connects it, or opens its config when it needs user credentials. */
  statusOnly?: boolean;
}

function MCPSelectContent({ statusOnly = false }: MCPSelectProps) {
  const localize = useLocalize();
  const context = useBadgeRowContext();
  const { conversationId, storageContextKey, mcpServerManager: manager } = context ?? {};

  const menuStore = Ariakit.useMenuStore({ focusLoop: true });
  const isOpen = menuStore.useState('open');

  const selectedServers = useMemo(() => {
    if (statusOnly) {
      return (
        manager?.selectableServers?.filter(
          (s) => manager.connectionStatus?.[s.serverName]?.connectionState === 'connected',
        ) ?? []
      );
    }
    if (!manager?.mcpValues || manager.mcpValues.length === 0) {
      return [];
    }
    const selectedSet = new Set(manager.mcpValues);
    return manager.selectableServers?.filter((s) => selectedSet.has(s.serverName));
  }, [statusOnly, manager?.selectableServers, manager?.mcpValues, manager?.connectionStatus]);

  const displayText = useMemo(() => {
    if (statusOnly) {
      return `${localize('com_ui_mcp_servers')} ${selectedServers?.length ?? 0}/${manager?.selectableServers?.length ?? 0}`;
    }
    const selectedCount = manager?.mcpValues?.length ?? 0;
    if (selectedCount === 0) {
      return null;
    }
    if (selectedCount === 1) {
      const server = manager?.selectableServers?.find(
        (s) => s.serverName === manager?.mcpValues?.[0],
      );
      return server?.config?.title || manager?.mcpValues?.[0];
    }
    return localize('com_ui_x_selected', { 0: selectedCount });
  }, [statusOnly, selectedServers, manager?.selectableServers, manager?.mcpValues, localize]);

  /** Servers that need nothing from the user (no OAuth, no credentials) only connect on first use;
   *  in status-only mode connect them once so the menu shows their real state. */
  const autoConnected = useRef(new Set<string>());
  useEffect(() => {
    if (!statusOnly || !manager?.connectionStatus) {
      return;
    }
    for (const { serverName } of manager.selectableServers ?? []) {
      const status = manager.connectionStatus[serverName];
      if (
        !status ||
        status.connectionState !== 'disconnected' ||
        status.requiresOAuth ||
        autoConnected.current.has(serverName)
      ) {
        continue;
      }
      const { hasCustomUserVars, isInitializing } = manager.getServerStatusIconProps(serverName);
      if (hasCustomUserVars || isInitializing) {
        continue;
      }
      autoConnected.current.add(serverName);
      manager.initializeServer(serverName, false);
    }
  }, [statusOnly, manager]);

  if (!manager) {
    return null;
  }

  const {
    isPinned,
    mcpValues,
    isInitializing,
    placeholderText,
    connectionStatus,
    selectableServers,
    getConfigDialogProps,
    initializeServer,
    toggleServerSelection,
    getServerStatusIconProps,
  } = manager;

  if (!statusOnly && !isPinned && mcpValues?.length === 0) {
    return null;
  }

  /** Same behavior as the MCP settings panel card: ask for credentials first when the server needs them. */
  const connectServer = (serverName: string) => {
    const { serverStatus, onConfigClick, isInitializing, hasCustomUserVars } =
      getServerStatusIconProps(serverName);
    if (isInitializing || serverStatus?.connectionState === 'connected') {
      return;
    }
    if (hasCustomUserVars) {
      onConfigClick({ stopPropagation: () => {}, preventDefault: () => {} } as React.MouseEvent);
      return;
    }
    initializeServer(serverName);
  };

  const configDialogProps = getConfigDialogProps();

  return (
    <>
      <Ariakit.MenuProvider store={menuStore}>
        <TooltipAnchor
          description={placeholderText}
          disabled={isOpen}
          render={
            <Ariakit.MenuButton
              className={cn(
                'group relative inline-flex items-center justify-center gap-1.5',
                'border border-border-medium text-sm font-medium transition-all',
                'h-9 min-w-9 rounded-full bg-transparent px-2.5 shadow-sm',
                'hover:bg-surface-hover hover:shadow-md active:shadow-inner',
                'md:w-fit md:justify-start md:px-3',
                isOpen && 'bg-surface-hover',
              )}
            />
          }
        >
          <StackedMCPIcons selectedServers={selectedServers} maxIcons={3} iconSize="sm" />
          <span className="hidden truncate text-text-primary md:block">
            {displayText || placeholderText}
          </span>
          <ChevronDown
            className={cn(
              'hidden h-3 w-3 text-text-secondary transition-transform md:block',
              isOpen && 'rotate-180',
            )}
          />
        </TooltipAnchor>

        <Ariakit.Menu
          portal={true}
          gutter={8}
          modal={true}
          unmountOnHide={true}
          aria-label={localize('com_ui_mcp_servers')}
          className={cn(
            'z-50 flex min-w-[260px] max-w-[320px] flex-col rounded-xl',
            'border border-border-light bg-presentation p-1.5 shadow-lg',
            'origin-top opacity-0 transition-[opacity,transform] duration-200 ease-out',
            'data-[enter]:scale-100 data-[enter]:opacity-100',
            'scale-95 data-[leave]:scale-95 data-[leave]:opacity-0',
          )}
        >
          <div className="flex max-h-[320px] flex-col gap-1 overflow-y-auto">
            {selectableServers.map((server) => (
              <MCPServerMenuItem
                key={server.serverName}
                server={server}
                isSelected={!statusOnly && (mcpValues?.includes(server.serverName) ?? false)}
                connectionStatus={connectionStatus}
                isInitializing={isInitializing}
                statusIconProps={getServerStatusIconProps(server.serverName)}
                onToggle={statusOnly ? connectServer : toggleServerSelection}
                statusOnly={statusOnly}
              />
            ))}
          </div>
        </Ariakit.Menu>
      </Ariakit.MenuProvider>
      {configDialogProps && (
        <MCPConfigDialog
          {...configDialogProps}
          conversationId={conversationId}
          storageContextKey={storageContextKey}
        />
      )}
    </>
  );
}

function MCPSelect({ statusOnly = false }: MCPSelectProps) {
  const context = useBadgeRowContext();
  const { selectableServers } = context?.mcpServerManager ?? {};
  const canUseMcp = useHasAccess({
    permissionType: PermissionTypes.MCP_SERVERS,
    permission: Permissions.USE,
  });

  if (!canUseMcp || !selectableServers || selectableServers.length === 0) {
    return null;
  }

  return <MCPSelectContent statusOnly={statusOnly} />;
}

export default memo(MCPSelect);
