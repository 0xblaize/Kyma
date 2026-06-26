import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("AgentVaultModule", (m) => {
  const treasury = m.getParameter("treasury", m.getAccount(0));

  const agentVault = m.contract("AgentVault", [treasury]);

  return { agentVault };
});
