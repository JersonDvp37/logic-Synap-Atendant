import { createContext, useCallback, useContext, useState } from "react";

const ChannelActionsContext = createContext(null);

export function ChannelActionsProvider({ children }) {
  const [headerAction, setHeaderAction] = useState(null);
  const updateHeaderAction = useCallback((action) => setHeaderAction(() => action), []);

  return (
    <ChannelActionsContext.Provider value={{ headerAction, setHeaderAction: updateHeaderAction }}>
      {children}
    </ChannelActionsContext.Provider>
  );
}

export function useChannelActions() {
  return useContext(ChannelActionsContext) || { headerAction: null, setHeaderAction: () => {} };
}
