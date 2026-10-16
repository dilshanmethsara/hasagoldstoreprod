import { Component, createContext, useContext, type ReactNode } from 'react';

const StoreContext = createContext<{ favorites: string[]; toggleFavorite: (id: string) => void }>({ favorites: [], toggleFavorite: () => {} });

export class StoreProvider extends Component<{ children: ReactNode }, { favorites: string[] }> {
  override state = { favorites: [] as string[] };

  toggleFavorite = (id: string) => {
    this.setState(({ favorites }) => ({
      favorites: favorites.includes(id)
        ? favorites.filter(item => item !== id)
        : [...favorites, id],
    }));
  };

  override render() {
    return (
      <StoreContext.Provider
        value={{ favorites: this.state.favorites, toggleFavorite: this.toggleFavorite }}
      >
        {this.props.children}
      </StoreContext.Provider>
    );
  }
}
export const useStore = () => useContext(StoreContext);