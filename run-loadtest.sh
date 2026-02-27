#!/bin/bash
set -e

# ============================================================
# Careers@Gov Booth Finder - Load Test Runner
# ============================================================
# Usage: ./run-loadtest.sh [smoke|full|all]
#   smoke  - Run smoke test only (1 user, 1 iteration)
#   full   - Run full load test only (~15 min)
#   all    - Run smoke test first, then full load test (default)
# ============================================================

BOLD="\033[1m"
GREEN="\033[0;32m"
RED="\033[0;31m"
YELLOW="\033[0;33m"
CYAN="\033[0;36m"
RESET="\033[0m"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
MODE="${1:-all}"

print_header() {
  echo ""
  echo -e "${CYAN}============================================================${RESET}"
  echo -e "${BOLD}$1${RESET}"
  echo -e "${CYAN}============================================================${RESET}"
  echo ""
}

print_step() {
  echo -e "${YELLOW}>>> $1${RESET}"
}

print_success() {
  echo -e "${GREEN}[OK] $1${RESET}"
}

print_error() {
  echo -e "${RED}[FAIL] $1${RESET}"
}

# ----------------------------------------------------------
# Step 1: Check and install dependencies
# ----------------------------------------------------------
install_dependencies() {
  print_header "Step 1: Checking Dependencies"

  # Check for Homebrew (macOS)
  if [[ "$OSTYPE" == "darwin"* ]]; then
    if ! command -v brew &>/dev/null; then
      print_step "Installing Homebrew..."
      /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
      print_success "Homebrew installed"
    else
      print_success "Homebrew found"
    fi
  fi

  # Check for Node.js
  if ! command -v node &>/dev/null; then
    print_step "Installing Node.js..."
    if [[ "$OSTYPE" == "darwin"* ]]; then
      brew install node
    elif command -v apt-get &>/dev/null; then
      curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
      sudo apt-get install -y nodejs
    elif command -v yum &>/dev/null; then
      curl -fsSL https://rpm.nodesource.com/setup_lts.x | sudo bash -
      sudo yum install -y nodejs
    else
      print_error "Could not install Node.js. Please install manually."
      exit 1
    fi
    print_success "Node.js $(node -v) installed"
  else
    print_success "Node.js $(node -v) found"
  fi

  # Check for npm
  if ! command -v npm &>/dev/null; then
    print_error "npm not found. Please install Node.js with npm."
    exit 1
  else
    print_success "npm $(npm -v) found"
  fi

  # Check for k6
  if ! command -v k6 &>/dev/null; then
    print_step "Installing k6..."
    if [[ "$OSTYPE" == "darwin"* ]]; then
      brew install k6
    elif command -v apt-get &>/dev/null; then
      sudo gpg -k
      sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
      echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
      sudo apt-get update
      sudo apt-get install -y k6
    elif command -v yum &>/dev/null; then
      sudo dnf install -y https://dl.k6.io/rpm/repo.rpm
      sudo dnf install -y k6
    else
      print_error "Could not install k6. Please install manually: https://k6.io/docs/get-started/installation/"
      exit 1
    fi
    print_success "k6 $(k6 version) installed"
  else
    print_success "k6 $(k6 version) found"
  fi

  echo ""
  print_success "All dependencies are installed"
}

# ----------------------------------------------------------
# Step 2: Run smoke test
# ----------------------------------------------------------
run_smoke_test() {
  print_header "Step 2: Running Smoke Test (1 user, 1 iteration)"
  print_step "Verifying all endpoints are reachable..."
  echo ""

  cd "$SCRIPT_DIR"
  if k6 run smoke-test.js; then
    echo ""
    print_success "Smoke test passed - all endpoints are healthy"
    return 0
  else
    echo ""
    print_error "Smoke test FAILED - endpoints may be down"
    print_error "Fix the issues above before running the full load test"
    return 1
  fi
}

# ----------------------------------------------------------
# Step 3: Run full load test
# ----------------------------------------------------------
run_full_load_test() {
  print_header "Step 3: Running Full Load Test (~15 minutes)"

  echo -e "  ${BOLD}Test Profile:${RESET}"
  echo "    - Warm up:           1 min  (0 → 5 VUs)"
  echo "    - Ramp to expected:  2 min  (5 → 19 VUs)"
  echo "    - Sustain expected:  5 min  (19 VUs)"
  echo "    - Ramp to 2x peak:  2 min  (19 → 38 VUs)"
  echo "    - Sustain 2x peak:  3 min  (38 VUs)"
  echo "    - Ramp down:         2 min  (38 → 0 VUs)"
  echo ""
  echo -e "  ${BOLD}Target:${RESET} https://find.careers.gov.sg"
  echo -e "  ${BOLD}Scenario:${RESET} 13,000 visitors / 8 hours / 70% app usage"
  echo ""

  cd "$SCRIPT_DIR"
  if k6 run load-test.js; then
    echo ""
    print_success "Load test completed"
  else
    echo ""
    print_error "Load test encountered errors"
    return 1
  fi
}

# ----------------------------------------------------------
# Step 4: Summary
# ----------------------------------------------------------
print_summary() {
  print_header "Reports Generated"

  TIMESTAMP=$(date "+%Y-%m-%d %H:%M:%S")

  echo -e "  ${BOLD}HTML Report:${RESET}     ${SCRIPT_DIR}/report.html"
  echo -e "  ${BOLD}JSON Report:${RESET}     ${SCRIPT_DIR}/report.json"
  echo -e "  ${BOLD}MD Report:${RESET}       ${SCRIPT_DIR}/load-test-report.md"
  echo ""
  echo -e "  ${BOLD}Completed at:${RESET}    ${TIMESTAMP}"
  echo ""
  echo -e "  Open the HTML report:"
  echo -e "    ${CYAN}open ${SCRIPT_DIR}/report.html${RESET}"
  echo ""
}

# ----------------------------------------------------------
# Main
# ----------------------------------------------------------
main() {
  print_header "Careers@Gov Booth Finder - Load Test Runner"
  echo -e "  Mode: ${BOLD}${MODE}${RESET}"

  case "$MODE" in
    smoke)
      install_dependencies
      run_smoke_test
      ;;
    full)
      install_dependencies
      run_full_load_test
      print_summary
      ;;
    all)
      install_dependencies
      if run_smoke_test; then
        echo ""
        print_step "Smoke test passed. Starting full load test in 5 seconds..."
        echo -e "  ${YELLOW}(Press Ctrl+C to cancel)${RESET}"
        sleep 5
        run_full_load_test
        print_summary
      else
        exit 1
      fi
      ;;
    *)
      echo "Usage: $0 [smoke|full|all]"
      echo "  smoke  - Run smoke test only"
      echo "  full   - Run full load test only"
      echo "  all    - Run smoke test, then full load test (default)"
      exit 1
      ;;
  esac
}

main
