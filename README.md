# Pivot

Temporizador de posição para o GNOME, para revezar entre trabalhar em pé, trabalhar sentado e fazer pausas. É uma versão no computador daquele cubo-temporizador que você gira na mesa.

- Ícone na barra de cima com a contagem e os seus timers favoritos (`15m — Em pé`, `10m — Descanso`…)
- Alerta no meio da tela, com som, quando o tempo acaba. Um botão já começa o próximo timer da sequência.
- Lembretes automáticos que se repetem (ex.: "Beber água" de hora em hora, das 9h às 18h, de segunda a sexta)
- Histórico do dia e da semana: tempo em pé e sentado, trocas de posição, água bebida
- Tema claro e escuro (segue o GNOME), no visual do design system do Lucas Mitchel Dev
- Em português e inglês
- Comando de terminal opcional: `pivot start em-pe`, `pivot log --hoje`

**Stack:** Python 3 + GTK4/libadwaita · SQLite · extensão do GNOME Shell (GJS) para a barra de cima.
Feito para Ubuntu / GNOME 50 (Wayland).

> Em construção. O plano está em [`docs/PLANO.md`](docs/PLANO.md).

---

Desenvolvido por [Lucas Mitchel Dev](https://lucasmitchel.dev).
