import { NavLink, Outlet } from "react-router-dom";
import {
  AtSign,
  CalendarClock,
  FolderOpen,
  Inbox,
  LayoutDashboard,
  Mail,
  MessageSquare,
  Paperclip,
  SlidersHorizontal,
} from "lucide-react";
import styles from "./ChannelNavigation.module.css";

const tabs = {
  whatsapp: [
    { to: "/atendimento", label: "Dashboard", icon: LayoutDashboard },
    { to: "/atendimento/conversas", label: "Conversas", icon: MessageSquare },
    { to: "/atendimento/arquivos", label: "Arquivos", icon: FolderOpen },
    { to: "/atendimento/agendamentos", label: "Agendamentos", icon: CalendarClock },
  ],
  gmail: [
    { to: "/atendimento/gmail", label: "Caixa de Entrada", icon: Inbox },
    { to: "/atendimento/gmail/compor", label: "Compor Email", icon: Mail },
    { to: "/atendimento/gmail/anexos", label: "Anexos Received", icon: Paperclip },
  ],
  settings: [
    { to: "/atendimento/configuracoes", label: "WhatsApp Config", icon: SlidersHorizontal },
    { to: "/atendimento/configuracoes/gmail", label: "Gmail Auth", icon: AtSign },
  ],
};

export function WhatsAppView() {
  return <ChannelFrame title="WhatsApp" tabs={tabs.whatsapp} />;
}

export function GmailView() {
  return <ChannelFrame title="Gmail" tabs={tabs.gmail} />;
}

export function ChannelSettingsView() {
  return <ChannelFrame title="Configurações de Canais" tabs={tabs.settings} />;
}

function ChannelFrame({ title, tabs: currentTabs }) {
  return (
    <div className={styles.root}>
      <nav
        className={`${styles.tabs} ${currentTabs.length === 2 ? styles.twoTabs : ""} ${currentTabs.length === 4 ? styles.fourTabs : ""}`}
        aria-label={`Sub-abas de ${title}`}
      >
        {currentTabs.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/atendimento" || to === "/atendimento/gmail" || to === "/atendimento/configuracoes"}
            aria-label={label}
            title={label}
            className={({ isActive }) => isActive ? styles.active : undefined}
          >
            <Icon size={18} aria-hidden="true" />
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </div>
  );
}
