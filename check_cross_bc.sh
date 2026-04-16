for bc in community identity messaging notification provisioning system; do
  echo "Checking $bc..."
  grep -rn -E "import.*from.*(community|identity|messaging|notification|provisioning|system)" ./packages/backend/src/application/$bc | grep -v "$bc"
done
