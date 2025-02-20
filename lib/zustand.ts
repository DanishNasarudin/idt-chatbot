import { create } from "zustand";

type GeneralStore = {
  navbarIsOpen: boolean | undefined;
  setNavbarIsOpen: () => void;
  setNavbarIsOpenLocaleStore: (newValue: boolean) => void;
};

export const useGeneralStore = create<GeneralStore>()((set) => ({
  navbarIsOpen: undefined,
  setNavbarIsOpen: () =>
    set((state) => ({ navbarIsOpen: !state.navbarIsOpen })),
  setNavbarIsOpenLocaleStore: (newValue) => set({ navbarIsOpen: newValue }),
}));
