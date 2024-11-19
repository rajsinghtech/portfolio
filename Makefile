local:
	hugo server --navigateToChanged
docker:
	docker compose up
init:
	git clone https://github.com/adityatelange/hugo-PaperMod.git themes/hugo-PaperMod