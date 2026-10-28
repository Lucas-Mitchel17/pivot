# Pivot: temporizador de posição para o GNOME

## Contexto
O Lucas quer trocar o cubo-temporizador físico (aquele que você gira e ele vibra no fim) por um app no Linux dele.
O app precisa de:
- timers com nome, como um despertador de celular ("Em pé 30 min", "Sentado 45 min", "Água");
- a contagem aparecendo na barra de cima do GNOME;
- um alerta na tela quando o tempo acabar;
- um histórico para ver se ele está mesmo trocando de posição e bebendo água.

Decisões dele:
- nome **Pivot**;
- app em **Python + GTK4/libadwaita**, mais uma **extensão GNOME** pequena para a barra de cima;
- alerta em **janela central com som**.

Ambiente verificado:
- Ubuntu, GNOME Shell 50.1, Wayland;
- o `/usr/bin/python3` (3.14) tem `gi`, Gtk 4, Adw 1 e Notify;
- o python do linuxbrew **não** tem `gi`, então tem que usar `/usr/bin/python3`;
- `gjs` e `sqlite3` estão disponíveis.

**Banco: SQLite, não MySQL.** É um app de uma pessoa só e local, então não precisa de servidor rodando. O banco é um arquivo só, fácil de fazer backup, e o Python já traz o módulo `sqlite3`.

## Onde fica
`/home/lucas-mitchel/Personal/Fisico/pivot/`, repositório público https://github.com/Lucas-Mitchel17/pivot (só o Lucas faz push).
Mockups das telas: https://claude.ai/artifact/EXqQwvzucn2UrBBxXnDwJv

```
pivot/
  pivot/                 # pacote python
    __main__.py          # entrada: Adw.Application (instância única) + linha de comando
    app.py               # PivotApp: motor de timers, D-Bus/linha de comando, grava o estado
    db.py                # SQLite: esquema, presets, sessões, consultas de resumo
    state.py             # escreve ~/.local/state/pivot/{current,presets}.json para a extensão
    ui/main_window.py    # abas: Timers (criar/editar/iniciar) | Histórico (por dia + resumo)
    ui/alert_window.py   # alerta central: título, Feito / +5 min / Próximo, som
  extension/pivot@lucasmitchel/   # extensão GNOME (ESM, GNOME 50)
    extension.js  metadata.json  stylesheet.css
  bin/pivot              # #!/usr/bin/python3 -> roda o pacote
  data/pivot.desktop  data/pivot-autostart.desktop
  install.sh             # cria links do bin/extensão/.desktop e ativa o autostart
```

## Como você usa no dia a dia (sem terminal)
1. **Ícone no canto de cima, à direita** (ao lado do Slack). Sem timer rodando, ele mostra só o ícone do Pivot. Com timer rodando, mostra `🧍 23:41`. Ao clicar, abre um menu:
   ```
   ⭐ 15m — Em pé
   ⭐ 45m — Sentado
   ⭐ 10m — Descanso
   ─────────────
   ⏹ Parar timer atual
   🔁 Lembretes automáticos: ligados   [interruptor]
   ─────────────
   Abrir Pivot…
   ```
   Um clique já inicia o timer.
2. **Ícone do app na grade de apps e na dock.** Com o `.desktop` e um ícone próprio, você pode fixar o Pivot na dock. Ele abre a janela principal.
3. **O terminal fica como extra** para quem quiser (`pivot start em-pe`, `pivot log --hoje`).

## Janela principal (3 abas)
- **Favoritos:** criar, editar e apagar timers (título, emoji, minutos, categoria, próximo da sequência). Uma estrela marca o que aparece no menu do ícone de cima.
- **Automáticos:** lembretes recorrentes, por exemplo *"Beber água" a cada 60 min, das 09:00 às 18:00, de seg a sex*. Cada um tem um interruptor para ligar e desligar, e há um botão de pausa geral (ex.: em reunião ou de folga).
- **Tema claro/escuro:** por padrão segue o GNOME (`Adw.StyleManager`); botão no topo da janela para forçar Sistema / Claro / Escuro, salvo em `settings` no SQLite. O alerta segue o mesmo tema.
- **Histórico:** lista por dia, com resumo de tempo em pé e sentado, trocas de posição e água bebida (os lembretes têm o botão "Bebi ✓").

## Visual, idiomas e assinatura
- **Design system:** o mesmo do Lucas Mitchel Dev (`~/Personal/Trabalho/Empresa/mitchel-design-system`, tema `lucas-mitchel-dev`).
  - Escuro por padrão, com modo claro. Os papéis semânticos (`--surface-*`, `--text-*`, `--action-*`, `--border-*`, `--brand-mark-*`) viram um CSS do GTK em `pivot/ui/style.css`, com os mesmos hex dos dois modos.
  - No escuro, a cor de ação é o gelo `#7de3ff` com texto `#05070e`. No claro, é o azul `#3f6bff`.
  - Fontes: Chakra Petch (títulos), IBM Plex Sans (texto) e IBM Plex Mono (contagem e horários). Se a fonte não estiver instalada, o app usa a do sistema.
- **Idiomas:** português (pt-BR) e inglês, usando `gettext`.
  - Por padrão segue o idioma do sistema, e dá para trocar nas preferências.
  - As traduções ficam em `po/pt_BR.po` e `po/en.po`, e os textos da extensão também passam pelo gettext.
- **Assinatura:** o rodapé da janela e o fim do menu da barra mostram o logo (`lucas-mitchel-dev-mark-lockup.svg`, com o gradiente gelo → azul).
  - Em pt-BR: "Desenvolvido por [logo] Lucas Mitchel Dev"; em inglês: "Sponsored by [logo] Lucas Mitchel Dev".
  - O texto é um link para https://lucasmitchel.dev.

## Como funciona
- **Processo único** (`Adw.Application`, id `io.github.lucasmitchel.Pivot`, `HANDLES_COMMAND_LINE`). Ele inicia junto com o login, em segundo plano. Rodar `pivot start em-pe` no terminal repassa o comando para a instância que já está rodando, um recurso que o GApplication já tem.
- **Linha de comando:**
  - `pivot start <preset>`
  - `pivot 30 "Em pé"` (timer avulso)
  - `pivot stop`
  - `pivot status`
  - `pivot log [--hoje|--semana]`
  - `pivot` sem argumentos abre a janela.
- **Ponte com a barra de cima:**
  - o app escreve `~/.local/state/pivot/current.json` (`{title, emoji, started_at, ends_at}`) e o `presets.json`;
  - a extensão acompanha esses arquivos com `Gio.FileMonitor` e mostra `🧍 23:41` na barra, atualizando a cada segundo com o próprio relógio dela;
  - o menu da extensão traz os presets (cada um roda `pivot start <id>`), "Parar" e "Abrir Pivot".
  - A extensão não tem nenhuma lógica nem banco, então fica fácil de manter quando o GNOME atualizar.
- **SQLite** em `~/.local/share/pivot/pivot.db`:
  - `presets(id, slug, title, emoji, minutes, category[posture|water|break], next_preset_id, favorite, sort_order, created_at)`;
  - `recurring(id, title, emoji, category, every_min, start_time, end_time, weekdays, enabled, last_fired_at)`. O agendador roda uma vez por minuto e dispara o alerta quando chega a hora. Esses lembretes rodam em paralelo com o timer de posição, sem interromper o que estiver rodando;
  - `sessions(id, preset_id, recurring_id, title, category, source[cli|menu|app|auto], started_at, planned_s, ended_at, outcome[done|snoozed|stopped|skipped])`.
- **Efeito "virar o cubo":** o `next_preset_id` encadeia os timers (Em pé → Sentado → Pausa → Em pé…). No alerta, o botão principal já começa o próximo timer.
- **Alerta:**
  - janela Adw centralizada e modal, com som (`canberra-gtk-play -i complete`, ou então `pw-play` com um som do freedesktop);
  - botões **Feito**, **+5 min** e **Começar <próximo>**;
  - a janela fica aberta até receber um clique.
  - Limitação do Wayland: o app não pode forçar a janela a ficar por cima de todas, então usa `present()` e também manda uma notificação.
- **Histórico:**
  - lista por dia;
  - resumo do dia e da semana: minutos em pé × sentado, número de trocas de posição, copos de água e timers interrompidos.
- **Presets iniciais (favoritos):** Em pé 30, Sentado 45, Descanso 10.
- **Automático inicial:** "Beber água" a cada 60 min, das 09:00 às 18:00, de seg a sex.
- O `presets.json` exportado leva só os favoritos, na ordem definida, e o estado do interruptor de automáticos. O menu da extensão é montado a partir dele.

## Ordem de implementação
1. `db.py` + motor de timers + linha de comando (testável sem interface: `pivot 1 teste`).
2. Janela de alerta + som.
3. `state.py` + extensão GNOME.
4. Agendador de lembretes automáticos.
5. Janela principal (Favoritos / Automáticos / Histórico).
6. Ícone do app (SVG), `.desktop` para a dock, `install.sh`, autostart e uma seção curta no `Fisico/CLAUDE.md` explicando o Pivot.

## Verificação
- `pivot 1 "Teste"` → depois de 1 min a janela central abre com som, e `pivot log --hoje` mostra a sessão com `outcome=done`.
- `sqlite3 ~/.local/share/pivot/pivot.db 'select * from sessions'` confere o que foi gravado.
- Extensão: testar numa sessão aninhada (`dbus-run-session gnome-shell --devkit --wayland`) ou fazer logout/login, depois `gnome-extensions enable pivot@lucasmitchel`. A contagem tem que aparecer na barra e os itens do menu têm que iniciar os timers.
- Encadeamento: terminar "Em pé" → clicar "Começar Sentado" → a barra muda para o novo timer.
- Criar um automático "a cada 2 min, agora até daqui a 10 min" → os alertas disparam e aparecem no Histórico com `source=auto`. Fora da janela de horário, nada dispara.
- O Pivot aparece na grade de apps, dá para fixar na dock e ele abre a janela.
- Reiniciar o app no meio de um timer → ele retoma pelo `ends_at` que ficou salvo.
