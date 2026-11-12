<svelte:head>
	<title>Event Information · Moon Rabbits</title>
	<meta name="description" content="Event information for Moon Rabbits." />
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link
		href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=Ma+Shan+Zheng&display=swap"
		rel="stylesheet"
	/>
</svelte:head>

<main
	class="relative flex min-h-screen items-center justify-center overflow-hidden bg-[var(--black)] px-8 py-16 text-center text-[var(--white)]"
>
	<div
		class="absolute inset-0 bg-cover bg-center opacity-35"
		style="background-image: url('https://cdn.astra-cloud-solutions.com/xunbao/shared/bg-image-6.webp');"
		aria-hidden="true"
	></div>
	<div class="absolute inset-0 bg-[var(--black)]/55" aria-hidden="true"></div>

	<section class="relative flex w-full max-w-2xl flex-col items-center">
		<img
			src="https://cdn.astra-cloud-solutions.com/xunbao/shared/info-hero.webp"
			alt="Moon Rabbits adventure"
			class="mb-8 w-full max-w-lg rounded-lg object-cover shadow-lg"
		/>

		<h1 class="font-cormorant text-3xl leading-tight font-semibold sm:text-4xl">
			Help Chang’e Find Her Missing Rabbits!
		</h1>
		<p class="mt-2 font-ma-shan-zheng text-2xl leading-tight sm:text-3xl">
			帮助嫦娥寻找失踪的玉兔！
		</p>

		<div class="my-10 h-px w-full bg-[var(--accent)]" aria-hidden="true"></div>

		<div class="space-y-5 font-cormorant text-xl leading-tight sm:text-2xl">
			<p>
				Chang’e’s rabbits are hiding around the park!<br />
				<span class="font-ma-shan-zheng text-2xl sm:text-3xl"
					>嫦娥的玉兔们躲在公园里！</span
				>
			</p>
			<p>
				Follow the clues to find them. Strike the magical pose and snap a photo to make them appear!<br />
				<span class="font-ma-shan-zheng text-2xl sm:text-3xl"
					>跟随线索找到它们，摆出神奇姿势并拍下照片，让玉兔现身吧！</span
				>
			</p>
		</div>

		<img
			src="https://cdn.astra-cloud-solutions.com/xunbao/shared/infographic-3.webp"
			alt="Moon Rabbits adventure infographic"
			class="mt-6 mb-4 w-full max-w-lg rounded-lg object-cover shadow-lg"
		/>

		<div class="my-6 flex w-full items-center justify-center gap-4" aria-hidden="true">
			<div class="h-px w-24 bg-[var(--accent)]"></div>
			<div class="size-3 rotate-45 bg-[var(--accent)]"></div>
			<div class="h-px w-24 bg-[var(--accent)]"></div>
		</div>

		<p class="font-cormorant text-3xl leading-tight font-semibold sm:text-4xl">
			Ready for the adventure?<br />
			<span class="font-ma-shan-zheng text-3xl sm:text-4xl">准备好出发了吗？</span>
		</p>

		<div class="mt-8 font-cormorant text-lg leading-tight sm:text-xl">
			<p>17 Sep – 27 Sep 2026</p>
			<p>Malaysia-China Friendship Park</p>
			<p class="font-ma-shan-zheng text-xl sm:text-2xl">马中友谊公园</p>
		</div>

		<div class="mx-auto my-3 h-px w-16 bg-[var(--accent)]" aria-hidden="true"></div>

		<p class="mt-4 font-cormorant text-sm">
			© 2026
			<a
				href="https://astra-cloud-solutions.com"
				target="_blank"
				rel="noopener noreferrer"
				class="underline underline-offset-2"
				>Astra Cloud Solutions</a
			>
		</p>
	</section>
</main>
