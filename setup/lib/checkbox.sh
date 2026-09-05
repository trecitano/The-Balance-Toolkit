#!/usr/bin/env bash
# Interactive checkbox picker. Compatible with bash 3.2.
#
#   pick_items LABELS_ARRAY_NAME DEFAULTS_ARRAY_NAME
#
# LABELS: display text per row. DEFAULTS: 1 = ticked, 0 = unticked.
# Result: PICKED array of 0/1 in the same order. Returns 1 if the user quits.
# A label starting with "##" is a section header: shown without a box, skipped
# by the cursor, and always 0 in PICKED.
# Keys: ↑/↓ or j/k move, space toggles, a = all, n = none, enter confirms, q quits.

pick_items() {
  local labels_name=$1 defaults_name=$2
  local _pi_labels=() _pi_picked=() n i cursor=0 key
  eval "_pi_labels=(\"\${${labels_name}[@]}\")"
  eval "_pi_picked=(\"\${${defaults_name}[@]}\")"
  n=${#_pi_labels[@]}
  is_header() { [[ ${_pi_labels[$1]} == '##'* ]]; }
  move() {  # move <+1|-1> to the next selectable row
    local step=$1 tries=0
    while ((tries++ < n)); do
      ((cursor = (cursor + step + n) % n))
      is_header "$cursor" || return 0
    done
  }
  while is_header "$cursor"; do ((cursor++)); ((cursor >= n)) && break; done

  local hide=$'\033[?25l' show=$'\033[?25h' up=$'\033[A' clr=$'\033[2K'

  draw() {
    local i box mark
    for ((i = 0; i < n; i++)); do
      if is_header "$i"; then
        printf '%s\r %s%s%s\n' "$clr" "$C_BOLD" "${_pi_labels[i]#\#\# }" "$C_RESET"
        continue
      fi
      if [[ ${_pi_picked[i]} == 1 ]]; then box="${C_GREEN}[x]${C_RESET}"; else box="[ ]"; fi
      if ((i == cursor)); then mark="${C_CYAN}❯${C_RESET}"; else mark=" "; fi
      printf '%s\r %s %s %s\n' "$clr" "$mark" "$box" "${_pi_labels[i]}"
    done
    printf '%s\r  %s↑/↓ move · space toggle · a all · n none · enter confirm · q quit%s\n' "$clr" "$C_DIM" "$C_RESET"
  }

  cleanup() {
    printf '%s' "$show"
    stty "$saved_stty" 2>/dev/null || true
  }

  local saved_stty
  saved_stty=$(stty -g)
  trap cleanup EXIT
  stty -echo -icanon min 1 time 0
  printf '%s' "$hide"
  draw
  while :; do
    IFS= read -rsn1 key || break
    if [[ $key == $'\033' ]]; then
      local rest=
      IFS= read -rsn2 -t 0.05 rest || true
      key+=$rest
    fi
    case "$key" in
      $'\033[A'|k) move -1 ;;
      $'\033[B'|j) move 1 ;;
      ' ') is_header "$cursor" || _pi_picked[cursor]=$((1 - _pi_picked[cursor])) ;;
      a) for ((i = 0; i < n; i++)); do is_header "$i" || _pi_picked[i]=1; done ;;
      n) for ((i = 0; i < n; i++)); do _pi_picked[i]=0; done ;;
      ''|$'\n'|$'\r') break ;;
      q|$'\033') cleanup; trap - EXIT; printf '\n'; return 1 ;;
    esac
    for ((i = 0; i <= n; i++)); do printf '%s' "$up"; done
    draw
  done
  cleanup
  trap - EXIT
  PICKED=("${_pi_picked[@]}")
  return 0
}
