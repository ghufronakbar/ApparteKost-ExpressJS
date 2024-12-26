import express from 'express'
import prisma from '../../db/prisma.js'
const router = express.Router()
import verification from "../../middleware/verification.js"

const boardings = async (req, res) => {
    const { id } = req.decoded;
    try {
        const allData = await prisma.boardingHouse.findMany({
            orderBy: {
                boardingHouseId: "desc"
            },
            include: {
                _count: {
                    select: {
                        bookings: {
                            where: {
                                isActive: true
                            }
                        }
                    }
                },
                pictures: {
                    select: {
                        picture: true
                    }
                },
                reviews: {
                    select: {
                        rating: true
                    }
                },
                bookmarks: {
                    select: {
                        bookmarkId: true,
                        userId: true,
                        bookmarkDate: true
                    }
                }
            },
            where: {
                AND: [
                    { isActive: true },
                    { isConfirmed: true },
                    { isPending: false }
                ]
            }
        });

        const all = [];
        const bookmarked = [];

        for (const d of allData) {
            d.averageRating = d.reviews.reduce((a, b) => a + b.rating, 0) / d.reviews.length || 0;

            if (d._count.bookings >= d.maxCapacity) continue;

            all.push(d);

            if (d.bookmarks) {
                for (const b of d.bookmarks) {
                    if (b.userId === id) {
                        d.bookmarkDate = b.bookmarkDate;
                        bookmarked.push(d);
                    }
                }
            }
            delete d.bookmarks;
        }

        all.sort((a, b) => b.averageRating - a.averageRating);

        bookmarked.sort((a, b) => new Date(b.bookmarkDate) - new Date(a.bookmarkDate));

        return res.status(200).json({ status: 200, message: 'Data semua kos', data: { all, bookmarked } });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ status: 500, message: 'Terjadi kesalahan' });
    }
};



const boarding = async (req, res) => {
    const { id } = req.params
    const { id: userId } = req.decoded
    try {
        if (isNaN(Number(id))) {
            return res.status(400).json({ status: 400, message: 'ID harus berupa angka!' })
        }
        const data = await prisma.boardingHouse.findFirst({
            where: {
                boardingHouseId: Number(id)
            },
            include: {
                _count: true,
                pictures: true,
                panoramas: true,
                reviews: {
                    select: {
                        reviewId: true,
                        rating: true,
                        comment: true,
                        createdAt: true,
                        userId: true,
                        user: {
                            select: {
                                name: true,
                                picture: true
                            }
                        }
                    }
                },
                bookings: true,
                bookmarks: {
                    select: {
                        bookmarkId: true,
                        userId: true,
                    }
                }
            }
        })
        if (!data) {
            return res.status(404).json({ status: 404, message: 'Tidak ada data ditemukan' })
        }
        data.averageRating = data.reviews.reduce((a, b) => a + b.rating, 0) / data.reviews.length || 0
        data.availableRoom = data.maxCapacity - data.bookings.filter((b) => b.isActive).length
        data.isBookmarked = data.bookmarks.some(b => b.userId === userId)
        const review = data.reviews.filter(r => r.userId === userId)
        data.review = review.length > 0 ? review[0] : null
        data.isReviewed = review.length > 0
        const booked = data.bookings.filter(b => (b.userId === userId) && b.isActive)
        data.booking = booked.length > 0 ? booked[0] : null
        data.isBooked = booked.length > 0
        delete data.bookmarks
        data.urlGoogleMap = `https://www.google.com/maps/search/?api=1&query=${data.location},${data.subdistrict},${data.district},Indonesia`
        data.urlWhatsapp = `https://wa.me/${data.phone}`
        return res.status(200).json({ status: 200, message: 'Detail Kos', data })
    } catch (error) {
        console.log(error)
        return res.status(500).json({ status: 500, message: 'Terjadi kesalahan' })
    }
}

const book = async (req, res) => {
    const { id } = req.decoded
    const { boardingHouseId } = req.body

    try {
        if (!boardingHouseId || isNaN(Number(boardingHouseId))) {
            return res.status(400).json({ status: 400, message: 'Lengkapi data!' })
        }
        const [user, boardingHouse] = await Promise.all([
            prisma.user.findFirst({ where: { userId: Number(id) } }),
            prisma.boardingHouse.findFirst({ where: { boardingHouseId: Number(boardingHouseId) } })
        ])
        if (!user || !boardingHouse) {
            return res.status(404).json({ status: 404, message: 'Tidak ada data ditemukan' })
        }
        const check = await prisma.booking.findFirst({
            where: {
                AND: [
                    { boardingHouseId: Number(boardingHouseId) },
                    { userId: Number(id) },
                    { isActive: true }
                ]
            }
        })
        if (check) {
            return res.status(400).json({ status: 400, message: 'Anda sudah memesan!' })
        }
        const booking = await prisma.booking.create({
            data: {
                boardingHouseId: Number(boardingHouseId),
                userId: Number(id),
                isActive: true,
                bookedDate: new Date()
            }
        })
        return res.status(200).json({ status: 200, message: 'Berhasil memesan kos', data: booking })
    } catch (error) {
        console.log(error)
        return res.status(500).json({ status: 500, message: 'Terjadi kesalahan' })
    }
}

const bookmark = async (req, res) => {
    const { id } = req.decoded
    const { boardingHouseId } = req.body
    try {
        if (!boardingHouseId || isNaN(Number(boardingHouseId))) {
            return res.status(400).json({ status: 400, message: 'Lengkapi data!' })
        }
        const [user, boardingHouse] = await Promise.all([
            prisma.user.findFirst({ where: { userId: Number(id) } }),
            prisma.boardingHouse.findFirst({ where: { boardingHouseId: Number(boardingHouseId) } })
        ])
        if (!user || !boardingHouse) {
            return res.status(404).json({ status: 404, message: 'Tidak ada data ditemukan' })
        }
        const check = await prisma.bookmark.findFirst({
            where: {
                AND: [
                    { boardingHouseId: Number(boardingHouseId) },
                    { userId: Number(id) }
                ]
            }
        })
        if (check) {
            await prisma.bookmark.delete({
                where: {
                    bookmarkId: check.bookmarkId
                }
            })

        } else {
            await prisma.bookmark.create({
                data: {
                    boardingHouseId: Number(boardingHouseId),
                    userId: Number(id)
                }
            })
        }
        return res.status(200).json({ status: 200, message: check ? 'Berhasil menghapus bookmark' : 'Berhasil menambahkan bookmark', data: bookmark })
    } catch (error) {
        console.log(error)
        return res.status(500).json({ status: 500, message: 'Terjadi kesalahan' })
    }
}

const review = async (req, res) => {
    const { id } = req.decoded
    const { boardingHouseId, rating, comment } = req.body
    try {
        if (!boardingHouseId || isNaN(Number(boardingHouseId)) || !rating || isNaN(Number(rating))) {
            return res.status(400).json({ status: 400, message: 'Lengkapi data!' })
        }
        if (Number(rating) < 1 || Number(rating) > 5) {
            return res.status(400).json({ status: 400, message: 'Rating tidak valid!' })
        }
        const [user, boardingHouse] = await Promise.all([
            prisma.user.findFirst({ where: { userId: Number(id) } }),
            prisma.boardingHouse.findFirst({ where: { boardingHouseId: Number(boardingHouseId) } })
        ])
        if (!user || !boardingHouse) {
            return res.status(404).json({ status: 404, message: 'Tidak ada data ditemukan' })
        }
        const check = await prisma.review.findFirst({
            where: {
                AND: [
                    { boardingHouseId: Number(boardingHouseId) },
                    { userId: Number(id) }
                ]
            }
        })
        if (check) {
            return res.status(400).json({ status: 400, message: 'Anda sudah memberi review!' })
        } else {
            const review = await prisma.review.create({
                data: {
                    boardingHouseId: Number(boardingHouseId),
                    userId: Number(id),
                    rating: Number(rating),
                    comment
                }
            })
            return res.status(200).json({ status: 200, message: 'Berhasil menambahkan review', data: review })
        }
    } catch (error) {
        console.log(error)
        return res.status(500).json({ status: 500, message: 'Terjadi kesalahan' })
    }
}

const keyLocation = async (req, res) => {
    try {
        const data = await prisma.boardingHouse.findMany({
            select: {
                boardingHouseId: true,
                district: true,
                subdistrict: true,
                _count: {
                    select: {
                        bookings: {
                            where: { isActive: true }
                        }
                    }
                },
                maxCapacity: true
            },
            where: {
                AND: [
                    { isActive: true },
                    { isConfirmed: true },
                    { isPending: false }
                ]
            }
        });

        const filteredData = data.filter(d => d._count.bookings < d.maxCapacity);

        const district = filteredData
            .map(d => d.district)
            .filter((value, index, self) => self.indexOf(value) === index);

        const subdistrict = filteredData
            .map(d => d.subdistrict)
            .filter((value, index, self) => self.indexOf(value) === index);

        return res.status(200).json({
            status: 200,
            message: 'Data lokasi',
            data: { district, subdistrict, all: [...district, ...subdistrict] }
        });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ status: 500, message: 'Terjadi kesalahan' });
    }
};

router.get("/", verification(["USER"]), boardings)
router.get("/key-location", verification(["USER"]), keyLocation)
router.put("/", verification(["USER"]), bookmark)
router.patch("/", verification(["USER"]), review)
router.get("/:id", verification(["USER"]), boarding)
router.post("/", verification(["USER"]), book)

export default router